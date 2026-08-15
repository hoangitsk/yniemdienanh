'use strict';

// =============================================================================
// YNDA AUTH + PERMISSION (XXIV) — đăng nhập qua FIREBASE AUTH (giống web chính)
// -----------------------------------------------------------------------------
// • Firebase chỉ dùng để XÁC THỰC tài khoản (email/password, Google...).
// • Dữ liệu thành viên (ROLE/DEPARTMENT/NAME/PHONE) lấy từ bảng xếp hạng:
//     - Role/ban mặc định tra từ sheet DATABASE CORE / DATABASE THÀNH VIÊN
//       (match theo EMAIL) khi user lần đầu đăng nhập hoặc qua syncUsersFromRanking.
//     - Bản ghi USERS trong cùng spreadsheet là nguồn role/ban chính thức.
//
// Job của Admin SDK: verifyIdToken + đọc Firestore/Firebase chỉ khi cần.
// KHÔNG lưu mật khẩu, KHÔNG dùng JWT tự chế.
//
// Cấu trúc quyền:
//   EXEC      = FOUNDER / PRESIDENT / CO_FOUNDER / CORE_FOUNDER (toàn quyền)
//   CORE      = tạo task, duyệt proof, giao task, review member...
//   VICE      = thực thi quản lý, hỗ trợ Core
//   MEMBER    = view, claim, start, submit proof
// =============================================================================

const config = require('./config');
const store = require('./store');
const { parseJson } = require('./utils');

const USERS_TAB = 'USERS';
const RANKING_SHEET_ID = process.env.SPREADSHEET_RANKING || '1SgbkoiSXP_zNYWN_AC6WKXTGQPbRAHfs2gwv_NOnsJM';

// Đọc Firebase Admin một cách an toàn (không crash khi thiếu credentials)
function firebaseAdmin() {
  try {
    return require('../../lib/firebaseAdmin');
  } catch (e) {
    return null;
  }
}

// -----------------------------------------------------------------------------
// VERIFY FIREBASE ID TOKEN — nguồn xác thực duy nhất
// -----------------------------------------------------------------------------
async function verifyIdToken(idToken) {
  const fb = firebaseAdmin();
  if (!fb || !fb.verifyRequestToken) {
    const err = new Error('Firebase Auth chưa được cấu hình (FIREBASE_SERVICE_ACCOUNT).');
    err.code = 'FIREBASE_NOT_CONFIGURED';
    throw err;
  }
  try {
    const decoded = await fb.verifyRequestToken({ body: { idToken }, headers: {} }, { requireEmailVerified: false });
    return decoded;
  } catch (e) {
    e.code = e.code || 'INVALID_TOKEN';
    throw e;
  }
}

// -----------------------------------------------------------------------------
// RANKING LOOKUP — tra role từ DATABASE CORE / DATABASE THÀNH VIÊN theo EMAIL
// -----------------------------------------------------------------------------
const ROLES_RAW = ['FOUNDER', 'PRESIDENT', 'CO_FOUNDER', 'CORE_FOUNDER', 'CORE', 'VICE', 'MEMBER'];

function normalizeText(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function mapRankingRole(value, tabName = '') {
  const v = String(value || '');
  const t = normalizeText(v);
  const tabNorm = normalizeText(tabName);

  if (/founder|sang lap|co founder|dong sang lap/.test(t)) return /co\b|dong/.test(t) ? 'CO_FOUNDER' : 'FOUNDER';
  if (/president|chu tich|truong du an|project lead|admin|quan tri|ban giam doc/.test(t)) return 'PRESIDENT';
  if (/vice|pho ban|pho truong|pho lead|pho nhom|pho/.test(t)) return 'VICE';
  if (/core|truong ban|truong lead|truong nhom|truong|head|lead|leader|dieu hanh|bdh|btc|ban to chuc|organizer|dieu phoi/.test(t)) return 'CORE';
  if (/member|thanh vien|ctv|cong tac vien/.test(t)) return 'MEMBER';

  if (/core|bdh|ban dieu hanh|to chuc|btc/.test(tabNorm)) return 'CORE';
  if (/thanh vien|member/.test(tabNorm)) return 'MEMBER';

  return ROLES_RAW.includes(v.toUpperCase()) ? v.toUpperCase() : '';
}

function canonicalDept(dept, rawRole = '', role = '', name = '') {
  const t = (String(dept || '') + ' ' + String(rawRole || '') + ' ' + String(role || '') + ' ' + String(name || '')).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').replace(/[_-]/g, ' ');
  
  if (/founder|president|chu tich|sang lap|co founder|dong sang lap|ban dieu hanh|bdh|dieu hanh|global/.test(t) ||
      /minh hoang|thanh nga|minh anh/.test(t)) {
    return 'Ban Điều Hành';
  }
  if (/nhan su|hr|anh thu|thao vy|my nga/.test(t)) return 'Ban Nhân Sự';
  if (/truyen thong|comms|mkt|marketing|pr|quynh giang|ngoc ha|ngoc phung|hoang ngan|thanh truc/.test(t)) return 'Ban Truyền Thông';
  if (/media|hau ky|san xuat|video|design|thanh thao/.test(t) || (name && name.includes('Yến Nhi') && (!dept || /media/i.test(dept) || /media/i.test(rawRole)))) return 'Ban Media';
  if (/noi dung|content|huu binh|phuong thao|thai anh|aris/.test(t)) return 'Ban Nội Dung';
  if (/duyet|kiem duyet|ngoc diep|phuong linh/.test(t) || (name && name.includes('Yến Nhi') && (!dept || /duyet/i.test(dept) || /duyet/i.test(rawRole)))) return 'Ban Duyệt Bài';
  
  if (dept) {
    const d = String(dept).trim();
    if (/duyet/i.test(d)) return 'Ban Duyệt Bài';
    if (/noi.*dung/i.test(d)) return 'Ban Nội Dung';
    if (/truyen.*thong/i.test(d)) return 'Ban Truyền Thông';
    if (/media/i.test(d)) return 'Ban Media';
    if (/nhan.*su/i.test(d)) return 'Ban Nhân Sự';
  }
  return 'Ban Khác';
}

function departmentFromBan(ban) {
  return canonicalDept(ban);
}

function departmentFromRoleTitle(roleTitle) {
  return canonicalDept('', roleTitle);
}

function departmentFromName(name) {
  return canonicalDept('', '', '', name);
}

function rankingColumns(headerRow) {
  const map = { name: -1, role: -1, email: -1, phone: -1, ban: -1, facebook: -1, note: -1, school: -1, address: -1, gender: -1, dob: -1 };
  if (!Array.isArray(headerRow)) return map;
  headerRow.forEach((col, idx) => {
    const c = normalizeText(col);
    if (/ho va ten|ho ten|ten|fullname|name/.test(c) && !/fb|facebook/.test(c)) {
      if (map.name === -1) map.name = idx;
    }
    else if (/chuc vu|vi tri|vai tro|role|position|chuc danh/.test(c)) map.role = idx;
    else if (/ban|phong ban|bo phan|dept|department/.test(c) && !/facebook/.test(c)) map.ban = idx;
    else if (/email|mail/.test(c)) map.email = idx;
    else if (/so dien thoai|sdt|dien thoai|phone|tel/.test(c)) map.phone = idx;
    else if (/facebook|link fb|fb|link facebook/.test(c)) map.facebook = idx;
    else if (/ghi chu|note|notes/.test(c)) map.note = idx;
    else if (/truong|lop|school/.test(c)) map.school = idx;
    else if (/noi sinh song|dia chi|address|que quan/.test(c)) map.address = idx;
    else if (/gioi tinh|gender/.test(c)) map.gender = idx;
    else if (/ngay sinh|dob|birth/.test(c)) map.dob = idx;
  });
  return map;
}

function findRankingHeaderRow(rows) {
  if (!Array.isArray(rows)) return null;
  const limit = Math.min(rows.length, 10);
  for (let r = 0; r < limit; r++) {
    const cols = rankingColumns(rows[r] || []);
    if (cols.name !== -1 || (cols.email !== -1 && cols.role !== -1) || (cols.ban !== -1 && cols.role !== -1)) {
      return { row: r, cols };
    }
  }
  return null;
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsvText(text) {
  const lines = String(text || '').split(/\r?\n/).filter(l => l.trim().length > 0);
  return lines.map(parseCsvLine);
}

// Đọc sheet ranking (DATABASE CORE + DATABASE THÀNH VIÊN + tabs khác)
// Hỗ trợ cả qua Google Sheets API và qua GViz CSV Public Endpoint
async function readRankingMembers(sheets, customSpreadsheetId) {
  const out = [];
  const seenKeys = new Set();
  const sid = customSpreadsheetId || RANKING_SHEET_ID;

  // 1. Thử đọc qua Google Sheets API nếu có client
  if (sheets && typeof sheets.spreadsheets === 'object') {
    try {
      const meta = await sheets.spreadsheets.get({ spreadsheetId: sid });
      const allTitles = (meta.data.sheets || []).map(s => s.properties.title);
      const coreTabs = allTitles.filter(t => /CORE|BĐH|BDH|ĐIỀU HÀNH|DIEU HANH|TỔ CHỨC|TO CHUC|BTC/i.test(t));
      const memTabs = allTitles.filter(t => /THÀNH VIÊN|THANH VIEN|MEMBER/i.test(t) && !coreTabs.includes(t));
      const otherTabs = allTitles.filter(t => !coreTabs.includes(t) && !memTabs.includes(t) && !/ĐIỂM|DIEM|TỔNG KẾT|TONG KET|ĐÁNH GIÁ|DANH GIA|CONFIG/i.test(t));
      const tabsToRead = [...coreTabs, ...memTabs, ...otherTabs];

      for (const tab of tabsToRead) {
        const res = await sheets.spreadsheets.values.get({
          spreadsheetId: sid,
          range: `'${tab}'!A1:N` + Math.min(2000, 500)
        }).catch(() => null);
        if (!res || !res.data || !res.data.values) continue;
        const rows = res.data.values;
        if (!rows.length) continue;
        const found = findRankingHeaderRow(rows);
        if (!found) continue;
        const { row: headerRow, cols } = found;
        let currentBan = '';
        for (let i = headerRow + 1; i < rows.length; i++) {
          const row = rows[i];
          const name = cols.name !== -1 ? String(row[cols.name] || '').trim() : '';
          if (!name || name.toLowerCase().includes('họ và tên') || name.toLowerCase().includes('database')) continue;
          if (cols.ban !== -1 && String(row[cols.ban] || '').trim()) {
            currentBan = String(row[cols.ban] || '').trim();
          }
          const rawRole = cols.role !== -1 ? String(row[cols.role] || '').trim() : '';
          const role = mapRankingRole(rawRole, tab) || (/core|bdh|btc/i.test(tab) ? 'CORE' : 'MEMBER');
          const email = cols.email !== -1 ? String(row[cols.email] || '').trim().toLowerCase() : '';
          const phone = cols.phone !== -1 ? String(row[cols.phone] || '') : '';
          const facebook = cols.facebook !== -1 ? String(row[cols.facebook] || '') : '';
          const notes = cols.note !== -1 ? String(row[cols.note] || '') : '';
          const school = cols.school !== -1 ? String(row[cols.school] || '') : '';
          const address = cols.address !== -1 ? String(row[cols.address] || '') : '';
          const gender = cols.gender !== -1 ? String(row[cols.gender] || '') : '';
          const dob = cols.dob !== -1 ? String(row[cols.dob] || '') : '';

          const memberObj = {
            email,
            role,
            name,
            rawRole,
            ban: currentBan,
            department: departmentFromRoleTitle(rawRole) || departmentFromBan(currentBan) || departmentFromName(name),
            phone,
            facebook,
            notes,
            school,
            address,
            gender,
            dob,
            tab
          };

          const key = email || (normalizeText(name) + '_' + normalizeText(currentBan));
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            out.push(memberObj);
          } else {
            const existingIdx = out.findIndex(m => (m.email && m.email === email) || normalizeText(m.name) === normalizeText(name));
            if (existingIdx !== -1 && (role === 'FOUNDER' || role === 'PRESIDENT' || role === 'CORE' || role === 'VICE')) {
              out[existingIdx] = { ...out[existingIdx], ...memberObj };
            }
          }
        }
      }
      if (out.length > 0) return out;
    } catch (sheetErr) {
      console.warn('[YNDA Ranking Sheets API lookup warning]:', sheetErr.message);
    }
  }

  // 2. Fallback: Đọc trực tiếp qua GViz CSV (áp dụng cho Sheet đã share link hoặc public)
  try {
    const tabsToFetch = [
      { name: 'DATABASE CORE', url: `https://docs.google.com/spreadsheets/d/${sid}/gviz/tq?tqx=out:csv&sheet=DATABASE%20CORE` },
      { name: 'DATABASE THÀNH VIÊN', url: `https://docs.google.com/spreadsheets/d/${sid}/gviz/tq?tqx=out:csv&sheet=DATABASE%20TH%C3%80NH%20VI%C3%8AN` },
      { name: 'DATABASE CORE GID', url: `https://docs.google.com/spreadsheets/d/${sid}/gviz/tq?tqx=out:csv&gid=1562189345` }
    ];

    for (const t of tabsToFetch) {
      try {
        const res = await fetch(t.url);
        if (!res.ok) continue;
        const csvText = await res.text();
        const rows = parseCsvText(csvText);
        const found = findRankingHeaderRow(rows);
        if (!found) continue;
        const { row: headerRow, cols } = found;

        let currentBan = '';
        for (let i = headerRow + 1; i < rows.length; i++) {
          const row = rows[i];
          const name = cols.name !== -1 ? String(row[cols.name] || '').trim() : '';
          if (!name || name.toLowerCase().includes('họ và tên') || name.toLowerCase().includes('database')) continue;

          if (cols.ban !== -1 && String(row[cols.ban] || '').trim()) {
            currentBan = String(row[cols.ban] || '').trim();
          }

          const rawRole = cols.role !== -1 ? String(row[cols.role] || '').trim() : '';
          const role = mapRankingRole(rawRole, t.name) || (/core|bdh|btc/i.test(t.name) ? 'CORE' : 'MEMBER');
          const email = cols.email !== -1 ? String(row[cols.email] || '').trim().toLowerCase() : '';
          const phone = cols.phone !== -1 ? String(row[cols.phone] || '').trim() : '';
          const facebook = cols.facebook !== -1 ? String(row[cols.facebook] || '').trim() : '';
          const notes = cols.note !== -1 ? String(row[cols.note] || '').trim() : '';
          const school = cols.school !== -1 ? String(row[cols.school] || '').trim() : '';
          const address = cols.address !== -1 ? String(row[cols.address] || '').trim() : '';
          const gender = cols.gender !== -1 ? String(row[cols.gender] || '').trim() : '';
          const dob = cols.dob !== -1 ? String(row[cols.dob] || '').trim() : '';

          const key = email || (normalizeText(name) + '_' + normalizeText(currentBan));
          const memberObj = {
            email,
            role,
            name,
            rawRole,
            ban: currentBan,
            department: departmentFromRoleTitle(rawRole) || departmentFromBan(currentBan) || departmentFromName(name),
            phone,
            facebook,
            notes,
            school,
            address,
            gender,
            dob,
            tab: t.name
          };

          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            out.push(memberObj);
          } else {
            const existingIdx = out.findIndex(m => (m.email && m.email === email) || normalizeText(m.name) === normalizeText(name));
            if (existingIdx !== -1 && (role === 'FOUNDER' || role === 'PRESIDENT' || role === 'CO_FOUNDER' || role === 'CORE' || role === 'VICE')) {
              out[existingIdx] = { ...out[existingIdx], ...memberObj };
            }
          }
        }
      } catch (tabErr) {
        console.warn(`[YNDA GViz fetch tab ${t.name} warning]:`, tabErr.message);
      }
    }
  } catch (gvizErr) {
    console.warn('[YNDA GViz global fetch warning]:', gvizErr.message);
  }

  return out;
}


// -----------------------------------------------------------------------------
// SANITIZE — không bao giờ trả password hash (bảng giờ không còn hash nữa)
// -----------------------------------------------------------------------------
function sanitizeUser(u) {
  if (!u) return null;
  const { PASSWORD_HASH, ...rest } = u;
  return rest;
}

async function findUserByEmail(email) {
  const s = store.store();
  await ensureCanonicalUsersTable(s);
  const rows = await s.list(USERS_TAB);
  return rows.find(r => !looksLikeHeaderRow(r) && String(r.EMAIL || '').toLowerCase() === String(email || '').toLowerCase()) || null;
}

// Hàng "rác" từ vòng lặp cũ: nội dung chính là text header (USER_ID/NAME/EMAIL...)
function looksLikeHeaderRow(u) {
  const e = String((u && u.EMAIL) || '');
  return !!e && /^(email|user_id|userid)$/i.test(e.trim());
}

// The old USERS sheet appended FIREBASE_UID at the end of the header.  That
// made later writes use a different column layout and could create duplicate
// profiles.  Rebuild once using field names (never positional values), so no
// existing member data is shifted or discarded.
async function ensureCanonicalUsersTable(s = store.store()) {
  const headers = require('./schema').SCHEMA.USERS;
  await s.ensureTable(USERS_TAB, headers);
  // InMemoryStore is already keyed by field name and has no physical sheet
  // header row to migrate.
  if (typeof s._getHeaders !== 'function') return s;
  const current = await s._getHeaders(USERS_TAB, headers);
  const canonical = current.length === headers.length && current.every((h, i) => h === headers[i]);
  if (!canonical) {
    const rows = await s.list(USERS_TAB);
    await s._rebuildTable(USERS_TAB, rows.filter(r => !looksLikeHeaderRow(r)), headers);
    console.warn('[YNDA] USERS header normalized to canonical schema.');
  }
  return s;
}

// Dùng chung cho login + sync: đọc ranking với cache 60s để giảm quota đọc.
let _rankingCachePromise = null;
let _rankingCacheAt = 0;
async function readRankingMembersCached() {
  const now = Date.now();
  if (_rankingCachePromise && now - _rankingCacheAt < 60000) return _rankingCachePromise;
  _rankingCacheAt = now;
  _rankingCachePromise = (async () => {
    try {
      const { google } = require('googleapis');
      const cred = require('../../lib/ynda/store').parseServiceAccount(
        process.env.GOOGLE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT
      );
      const auth = new google.auth.JWT(cred.client_email, null, cred.private_key,
        ['https://www.googleapis.com/auth/spreadsheets.readonly']);
      const sheets = google.sheets({ version: 'v4', auth });
      const members = await readRankingMembers(sheets);
      // Chỉ cache khi THÀNH CÔNG (non-empty). Nếu đọc lỗi/trả rỗng -> bỏ cache
      // để lần login sau được thử lại (không kẹt role MEMBER vì 1 lần lỗi).
      if (!members || !members.length) _rankingCachePromise = null;
      return members || [];
    } catch (e) {
      console.warn('[YNDA] ranking lookup failed:', e.message);
      _rankingCachePromise = null; // không cache lỗi
      return [];
    }
  })();
  return _rankingCachePromise;
}

// Lock trong process theo email: 2 request login song song cùng email
// (ví dụ double-restoreSession, 2 tab) chỉ tạo ĐÚNG 1 user — hết trùng.
const ensureLocks = {};
async function ensureUserSheet(uid, email, name, firebaseProfile) {
  const key = String(email || '').toLowerCase();
  if (ensureLocks[key]) return ensureLocks[key];
  ensureLocks[key] = (async () => ensureUserSheetInner(uid, email, name, firebaseProfile))()
    .then(u => { delete ensureLocks[key]; return u; })
    .catch(e => { delete ensureLocks[key]; throw e; });
  return ensureLocks[key];
}

// Nếu bảng USERS phồng quá (hàng nghìn dòng — vòng lặp skip-header cũ), rebuild
// sạch: clear toàn bộ + ghi lại header + chỉ 1 bản best mỗi email (2 request).
// Tự gọi khi login/access phát hiện sheet phồng để dừng vòng lặp tốn quota.
async function ensureCleanUsersTable() {
  const s = store.store();
  const rows = await s.list(USERS_TAB);
  if (rows.length < 500) return 0; // thực tế: vài chục user, 500 là quá đủ
  const groups = {};
  for (const u of rows) {
    if (looksLikeHeaderRow(u)) continue;
    const k = String(u.EMAIL || '').toLowerCase();
    if (!k || !u.USER_ID) continue;
    const jt = Date.parse(String(u.JOINED_AT || '') || '');
    const score = (u.FIREBASE_UID ? 100000 : 0) + (Number.isFinite(jt) ? jt : 0);
    if (!groups[k] || score > groups[k]._score) groups[k] = { ...u, _score: score };
  }
  const clean = Object.keys(groups).map(k => { const { _score, ...u } = groups[k]; return u; });
  await s._rebuildTable(USERS_TAB, clean);
  console.warn(`[YNDA] clean USERS: ${rows.length} -> ${clean.length} dòng (sheet phồng, đã rebuild)`);
  return rows.length - clean.length;
}

async function ensureUserSheetInner(uid, email, name, firebaseProfile) {
  const s = store.store();
  await ensureCanonicalUsersTable(s);
  // Nếu sheet đang phồng (45k dòng rác) -> rebuild sạch ngay, trước khi tạo/đọc.
  try { if (await ensureCleanUsersTable()) { /* vừa dọn xong */ } } catch (e) { console.warn('[YNDA] clean on login failed:', e.message); }
  const existing = await s.list(USERS_TAB);
  // Firebase UID is the stable account identity.  Email remains the fallback
  // for legacy users whose UID has not been written yet.
  let user = existing.find(r => !looksLikeHeaderRow(r) && String(r.FIREBASE_UID || '') === String(uid || ''))
    || existing.find(r => !looksLikeHeaderRow(r) && String(r.EMAIL || '').toLowerCase() === String(email || '').toLowerCase());

  if (user && user.STATUS === 'ARCHIVED') {
    const err = new Error('Tài khoản đã bị vô hiệu hóa.');
    err.code = 'ARCHIVED';
    throw err;
  }

  if (!user) {
    // Lần đầu đăng nhập bằng Firebase -> tra role/ban từ sheet ranking và Firebase profile
    let role = 'MEMBER';
    let department = 'GLOBAL';
    let rankName = '';
    let rankPhone = '';

    const normEmail = String(email || '').toLowerCase().trim();
    if (normEmail === 'yniemdienanh@gmail.com') {
      role = 'FOUNDER';
      department = 'GLOBAL';
      rankName = 'Ban Tổ Chức · Ý Niệm Điện Ảnh';
    }

    try {
      const members = await module.exports.readRankingMembersCached();
      const match = (members || []).find(m => String(m.email || '').toLowerCase().trim() === normEmail);
      if (match) {
        role = config.normalizeRole(match.role) || role;
        department = match.department || departmentFromName(match.name) || department;
        rankName = match.name || rankName;
        rankPhone = match.phone || rankPhone;
      }
    } catch (e) {
      console.warn('[YNDA] ranking lookup failed:', e.message);
    }

    // Tra thêm profile từ Firebase / Firestore nếu có
    if (firebaseProfile) {
      const pRole = String(firebaseProfile.role || '').toLowerCase();
      if (['admin', 'organizer', 'founder'].includes(pRole)) role = 'FOUNDER';
      else if (pRole === 'president') role = 'PRESIDENT';
      else if (pRole === 'core') role = 'CORE';
      else if (pRole === 'vice') role = 'VICE';

      if (firebaseProfile.dept) {
        const d = departmentFromBan(firebaseProfile.dept);
        if (d) department = d;
      }
      if (firebaseProfile.name && !rankName) rankName = firebaseProfile.name;
    }

    const userId = store.uid('USR');
    user = {
      USER_ID: userId,
      NAME: rankName || name || (firebaseProfile && firebaseProfile.name) || email.split('@')[0],
      EMAIL: String(email || '').toLowerCase(),
      ROLE: role,
      DEPARTMENT: department,
      SEASON_ID: '',
      STATUS: 'ACTIVE',
      PHONE: rankPhone || (firebaseProfile && firebaseProfile.phoneNumber) || '',
      AVATAR: (firebaseProfile && firebaseProfile.photoURL) || '',
      PASSWORD_HASH: '',
      FIREBASE_UID: uid,
      JOINED_AT: new Date().toISOString(),
      CREATED_BY: 'firebase-auth',
      CREATED_AT: new Date().toISOString(),
      UPDATED_AT: new Date().toISOString()
    };
    await s.insert(USERS_TAB, user);
    // Cross-instance (Vercel nhiều lambda) có thể tạo trùng cùng lúc.
    // Nếu trùng ÍT -> xoá từng dòng; nếu sheet phồng (hàng nghìn dòng rác
    // từ vòng lặp cũ) -> rebuild sạch 1 lần (2 request) thay vì remove lẻ
    // (mỗi remove = 1 write -> vỡ quota 60/min ngay lập tức).
    try {
      const again = await s.list(USERS_TAB);
      const dups = again.filter(r => String(r.EMAIL || '').toLowerCase() === String(email || '').toLowerCase() && r.USER_ID !== user.USER_ID);
      if (dups.length) {
        if (dups.length <= 20) {
          for (const d of dups) await s.remove(USERS_TAB, 'USER_ID', d.USER_ID);
          console.warn(`[YNDA] heal: xoá ${dups.length} user trùng ${email}`);
        } else {
          console.warn(`[YNDA] heal: sheet phồng ${again.length} dòng, rebuild sạch (${dups.length} trùng ${email})`);
          await ensureCleanUsersTable();
        }
      }
    } catch (e) { console.warn('[YNDA] heal failed:', e.message); }
  } else {
    // User đã tồn tại: liên kết Firebase UID + bổ sung hồ sơ còn thiếu.
    const autoManaged = ['firebase-auth', 'ranking-sync'].includes(String(user.CREATED_BY || ''));
    const patch = {};
    const normEmail = String(email || '').toLowerCase().trim();
    if (uid && !user.FIREBASE_UID) patch.FIREBASE_UID = uid;
    if (name && !user.NAME) patch.NAME = name;

    if (normEmail === 'yniemdienanh@gmail.com') {
      if (user.ROLE !== 'FOUNDER') patch.ROLE = 'FOUNDER';
      if (user.DEPARTMENT !== 'GLOBAL') patch.DEPARTMENT = 'GLOBAL';
      if (!user.NAME || user.NAME === 'Khách ghé thăm') patch.NAME = 'Ban Tổ Chức · Ý Niệm Điện Ảnh';
    }

    if (firebaseProfile) {
      const pRole = String(firebaseProfile.role || '').toLowerCase();
      if (['admin', 'organizer', 'founder'].includes(pRole) && user.ROLE !== 'FOUNDER') patch.ROLE = 'FOUNDER';
      else if (pRole === 'president' && user.ROLE !== 'PRESIDENT') patch.ROLE = 'PRESIDENT';
      else if (pRole === 'core' && user.ROLE !== 'CORE') patch.ROLE = 'CORE';
      else if (pRole === 'vice' && user.ROLE !== 'VICE') patch.ROLE = 'VICE';
      if (firebaseProfile.name && !user.NAME) patch.NAME = firebaseProfile.name;
    }

    if (autoManaged) {
      try {
        const members = await module.exports.readRankingMembersCached();
        const match = (members || []).find(m => String(m.email || '').toLowerCase().trim() === normEmail);
        if (match) {
          const wantRole = config.normalizeRole(match.role) || 'MEMBER';
          const wantDept = match.department || departmentFromName(match.name) || 'GLOBAL';
          if (user.ROLE !== wantRole && user.ROLE !== 'FOUNDER') patch.ROLE = wantRole;
          if (user.DEPARTMENT !== wantDept) patch.DEPARTMENT = wantDept;
          if (!user.NAME && match.name) patch.NAME = match.name;
          if (!user.PHONE && match.phone) patch.PHONE = match.phone;
        }
      } catch (e) {
        console.warn('[YNDA] ranking role refresh failed:', e.message);
      }
    }
    if (Object.keys(patch).length) {
      user = await s.update(USERS_TAB, 'USER_ID', user.USER_ID, { ...patch, UPDATED_AT: new Date().toISOString() });
    }
  }
  return sanitizeUser(user);
}

// -----------------------------------------------------------------------------
// LOGIN VIA FIREBASE ID TOKEN
// -----------------------------------------------------------------------------
async function loginFirebase(idToken) {
  const decoded = await verifyIdToken(idToken);
  const email = String(decoded.email || '').toLowerCase();
  if (!email) {
    const err = new Error('Tài khoản Firebase thiếu email.');
    err.code = 'NO_EMAIL';
    throw err;
  }
  const user = await ensureUserSheet(decoded.uid, email, decoded.name, decoded);
  return { userId: user.USER_ID, email: user.EMAIL, user };
}

async function getOrCreateByEmail(email, { name, role, department, phone } = {}) {
  const s = store.store();
  await ensureCanonicalUsersTable(s);
  const user = await findUserByEmail(email);
  if (user) return sanitizeUser(user);
  const userId = store.uid('USR');
  const record = {
    USER_ID: userId,
    NAME: name || email.split('@')[0],
    EMAIL: String(email || '').toLowerCase(),
    ROLE: config.normalizeRole(role) || 'MEMBER',
    DEPARTMENT: department || 'GLOBAL',
    SEASON_ID: '',
    STATUS: 'ACTIVE',
    PHONE: phone || '',
    AVATAR: '',
    PASSWORD_HASH: '',
    FIREBASE_UID: '',
    JOINED_AT: new Date().toISOString(),
    CREATED_BY: 'manual',
    CREATED_AT: new Date().toISOString(),
    UPDATED_AT: new Date().toISOString()
  };
  await s.insert(USERS_TAB, record);
  return sanitizeUser(record);
}

// -----------------------------------------------------------------------------
// RANKING SYNC — đồng bộ DANH SÁCH THÀNH VIÊN từ sheet ranking vào USERS
// -----------------------------------------------------------------------------
// Đọc toàn bộ DATABASE CORE + DATABASE THÀNH VIÊN rồi upsert vào bảng USERS:
//   • email chưa có       -> tạo mới (ROLE/DEPARTMENT theo bảng xếp hạng)
//   • email đã có          -> cập nhật NAME/ROLE/DEPARTMENT/PHONE theo ranking
// Trả về { created, updated }.
async function syncUsersFromRanking(membersOverride) {
  const s = store.store();
  await ensureCanonicalUsersTable(s);
  let members = membersOverride;
  if (!members) {
    members = await module.exports.readRankingMembersCached();
  }
  if (!members || !members.length) throw new Error('Không đọc được dữ liệu thành viên từ sheet ranking.');

  const existing = await s.list(USERS_TAB);
  // Gom nhóm theo email, chọn 1 dòng "tốt nhất"/email (ưu tiên có FIREBASE_UID).
  // Cross-instance + header lệch khiến sheet cũ có nhiều dòng trùng -> clean.
  const groups = {};
  for (const u of existing) {
    if (looksLikeHeaderRow(u)) continue;
    const k = String(u.EMAIL || '').toLowerCase();
    if (!k || !u.USER_ID) continue;
    const jt = Date.parse(String(u.JOINED_AT || '') || '');
    const score = (u.FIREBASE_UID ? 100000 : 0) + (Number.isFinite(jt) ? jt : 0);
    if (!groups[k] || score > groups[k]._score) groups[k] = { ...u, _score: score };
  }
  const cleanRows = Object.keys(groups).map(k => { const { _score, ...u } = groups[k]; return u; });
  const dirty = existing.length > cleanRows.length; // có dòng trùng bị loại bỏ

  // Reconcile theo ranking (trong memory trước)
  let created = 0, updated = 0;
  const finalRows = cleanRows.map(u => ({ ...u }));
  for (const m of members) {
    const idx = finalRows.findIndex(u => String(u.EMAIL || '').toLowerCase() === m.email);
    if (idx === -1) {
      finalRows.push({
        USER_ID: store.uid('USR'),
        NAME: m.name || m.email.split('@')[0],
        EMAIL: m.email,
        ROLE: config.normalizeRole(m.role),
        DEPARTMENT: m.department || 'GLOBAL',
        SEASON_ID: '', STATUS: 'ACTIVE',
        PHONE: m.phone || '', AVATAR: '', PASSWORD_HASH: '',
        FIREBASE_UID: '',
        JOINED_AT: new Date().toISOString(),
        CREATED_BY: 'ranking-sync',
        CREATED_AT: new Date().toISOString(),
        UPDATED_AT: new Date().toISOString()
      });
      created++;
    } else {
      const cur = finalRows[idx];
      const patch = {};
      const wantRole = config.normalizeRole(m.role);
      if (cur.ROLE !== wantRole) patch.ROLE = wantRole;
      if (m.department && cur.DEPARTMENT !== m.department) patch.DEPARTMENT = m.department;
      if (m.name && (!cur.NAME || cur.CREATED_BY === 'ranking-sync') && cur.NAME !== m.name) patch.NAME = m.name;
      if (m.phone && cur.PHONE !== m.phone) patch.PHONE = m.phone;
      if (Object.keys(patch).length) {
        Object.assign(cur, patch, { UPDATED_AT: new Date().toISOString() });
        updated++;
      }
    }
  }

  // Nếu bảng hỏng (trùng many dòng / cột lệch) -> rebuild sạch bằng 1 clear + 1 append
  if (dirty || created > 0) {
    await s._rebuildTable(USERS_TAB, finalRows);
  } else {
    // Cập nhật từng dòng đã thay đổi (trong memory) bằng update 1-dòng
    for (let i = 0; i < cleanRows.length; i++) {
      const before = cleanRows[i];
      const after = finalRows[i];
      const patch = {};
      for (const k of Object.keys(after)) {
        if (k === 'USER_ID' || k === 'EMAIL') continue;
        if (String(after[k] || '') !== String(before[k] || '')) patch[k] = after[k];
      }
      if (Object.keys(patch).length) {
        patch.UPDATED_AT = new Date().toISOString();
        await s.update(USERS_TAB, 'USER_ID', after.USER_ID, patch);
      }
    }
  }
  return { synced: created + updated, created, updated, total: members.length };
}

async function getUser(userId) {
  const s = store.store();
  const u = await s.get(USERS_TAB, 'USER_ID', String(userId));
  return sanitizeUser(u);
}

async function getUserByFirebaseUid(uid) {
  const s = store.store();
  await ensureCanonicalUsersTable(s);
  const rows = await s.list(USERS_TAB);
  const u = rows.find(r => String(r.FIREBASE_UID || '') === String(uid || ''));
  return sanitizeUser(u);
}

async function listUsers(filter = {}) {
  const s = store.store();
  await ensureCanonicalUsersTable(s);
  let rows = await s.list(USERS_TAB);
  if (filter.department) rows = rows.filter(r => String(r.DEPARTMENT || '') === String(filter.department));
  if (filter.role) rows = rows.filter(r => String(r.ROLE || '') === String(filter.role));
  return rows.map(sanitizeUser);
}

// Middleware Express — xác thực bằng Bearer idToken của Firebase
async function resolveFirebaseUser(req) {
  const fb = firebaseAdmin();
  let decoded = null;
  if (fb && fb.tokenFromRequest) {
    const token = fb.tokenFromRequest(req);
    if (token) {
      try {
        decoded = await fb.verifyRequestToken(req, { requireEmailVerified: false });
      } catch (e) {
        decoded = null;
      }
    }
  }
  if (!decoded) return null;
  const email = String(decoded.email || '').toLowerCase();
  let user = null;
  try { user = await ensureUserSheet(decoded.uid, email, decoded.name, decoded); } catch (e) { user = null; }
  if (!user || user.STATUS === 'ARCHIVED') return null;
  return { decoded, user: sanitizeUser(user) };
}

function requireRole(category, action) {
  return async (req, res, next) => {
    try {
      const ctx = await resolveFirebaseUser(req);
      if (!ctx) return res.status(401).json({ error: 'Vui lòng đăng nhập.' });
      const allowed = config.can(ctx.user.ROLE, category, action);
      if (!allowed) return res.status(403).json({ error: 'Không có quyền thực hiện thao tác này.' });
      req.yndaUser = ctx.user;
      req.firebaseDecoded = ctx.decoded;
      next();
    } catch (e) {
      res.status(401).json({ error: e.message || 'Xác thực thất bại.' });
    }
  };
}

module.exports = {
  hashPassword: null, verifyPassword: null, // bỏ: không còn password riêng
  loginFirebase, verifyIdToken, getOrCreateByEmail,
  getUser, getUserByFirebaseUid, listUsers, sanitizeUser,
  resolveFirebaseUser, requireRole, findUserByEmail,
  readRankingMembers, mapRankingRole, departmentFromName, canonicalDept, syncUsersFromRanking,
  readRankingMembersCached, ensureUserSheet, ensureCleanUsersTable, ensureCanonicalUsersTable,
  rankingColumns, findRankingHeaderRow, parseCsvLine, parseCsvText
};
