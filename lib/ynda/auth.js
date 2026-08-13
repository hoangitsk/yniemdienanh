'use strict';

// =============================================================================
// YNDA AUTH + PERMISSION (XXIV) — đăng nhập qua FIREBASE AUTH (giống web chính)
// -----------------------------------------------------------------------------
// • Firebase chỉ dùng để XÁC THỰC tài khoản (email/password, Google...).
// • Dữ liệu thành viên (ROLE/DEPARTMENT) lấy từ Google Sheets:
//     - Role mặc định tra từ sheet DATABASE CORE / DATABASE THÀNH VIÊN của
//       bảng xếp hạng (match theo EMAIL) khi user lần đầu đăng nhập.
//     - Bản ghi USERS trong sheet YNDA là nguồn role chính thức cho XP/BXH.
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

function mapRankingRole(value) {
  const v = String(value || '');
  const t = v.toLowerCase();
  if (/founder|sáng lập/.test(t)) return /co\b|đồng/.test(t) ? 'CO_FOUNDER' : 'FOUNDER';
  if (/president|chủ tịch/.test(t)) return 'PRESIDENT';
  if (/core/.test(t)) return 'CORE';
  if (/vice|phó/.test(t)) return 'VICE';
  if (/member|thành viên/.test(t)) return 'MEMBER';
  return ROLES_RAW.includes(v.toUpperCase()) ? v.toUpperCase() : '';
}

function rankingColumns(headers) {
  const cols = {};
  headers.forEach((h, i) => {
    const norm = String(h).toLowerCase().trim();
    if (norm.includes('tên') || norm.includes('name')) cols.name = i;
    else if (norm.includes('chức') || norm.includes('vai_trò') || norm.includes('role') || norm.includes("vai trò")) cols.role = i;
    else if (norm.includes('email')) cols.email = i;
    else if (norm.includes('số điện thoại') || norm.includes('phone')) cols.phone = i;
    else if (norm.includes('link facebook')) cols.facebook = i;
    else if (norm.includes('ghi chú')) cols.note = i;
    else if (norm === 'ban') cols.ban = i;
  });
  return cols;
}

// Đọc sheet ranking (DATABASE CORE + DATABASE THÀNH VIÊN) — copy logic từ sheet
async function readRankingMembers(sheets) {
  const out = [];
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: RANKING_SHEET_ID });
    const tabs = meta.data.sheets.map(s => s.properties.title).filter(t => /DATABASE (CORE|THÀNH VIÊN|THANH VIEN)/i.test(t));
    for (const tab of tabs) {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: RANKING_SHEET_ID,
        range: `'${tab}'!A1:J` + Math.min(2000, 300)
      }).catch(() => null);
      if (!res || !res.data || !res.data.values) continue;
      const rows = res.data.values;
      if (!rows.length) continue;
      const cols = rankingColumns(rows[0]);
      if (cols.email == null || cols.role == null) continue;
      let currentBan = '';
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const email = String(row[cols.email] || '').trim().toLowerCase();
        if (!email) continue;
        if (cols.ban != null && String(row[cols.ban] || '').trim()) {
          currentBan = String(row[cols.ban] || '').trim();
        }
        const rawRole = String(row[cols.role] || '').trim();
        const role = mapRankingRole(rawRole);
        if (!role) continue;
        out.push({
          email,
          role,
          name: cols.name != null ? String(row[cols.name] || '').trim() : '',
          department: departmentFromRoleTitle(rawRole) || departmentFromBan(currentBan) || (cols.name != null ? departmentFromName(row[cols.name]) : ''),
          phone: cols.phone != null ? String(row[cols.phone] || '') : ''
        });
      }
    }
  } catch (e) {
    console.warn('[YNDA ranking lookup]', e.message);
  }
  return out;
}

function departmentFromName(name) {
  const n = String(name || '');
  if (/core (hr|nhân sự|nhan su)/i.test(n)) return 'NHAN_SU';
  if (/core (comms|truyền thông)/i.test(n)) return 'TRUYEN_THONG';
  if (/core (media)/i.test(n)) return 'MEDIA';
  if (/core (nội dung)/i.test(n)) return 'NOI_DUNG';
  if (/core (duyệt)/i.test(n)) return 'DUYET_BAI';
  return 'GLOBAL';
}

function departmentFromRoleTitle(v) {
  const t = String(v || '').toLowerCase();
  if (/hr|nhân sự|nhan su/.test(t)) return 'NHAN_SU';
  if (/comms|truyền thông|truyen thong/.test(t)) return 'TRUYEN_THONG';
  if (/media/.test(t)) return 'MEDIA';
  if (/nội dung|noi dung/.test(t)) return 'NOI_DUNG';
  if (/duyệt|duyet/.test(t)) return 'DUYET_BAI';
  return '';
}

// Map tên ban (cột BAN trong sheet ranking) -> DEPARTMENT
function departmentFromBan(b) {
  const t = String(b || '').trim().toLowerCase();
  if (t.includes('nhân sự') || t.includes('nhan su') || t.includes('hr')) return 'NHAN_SU';
  if (t.includes('truyền thông') || t.includes('truyen thong') || t.includes('comms')) return 'TRUYEN_THONG';
  if (t.includes('media')) return 'MEDIA';
  if (t.includes('nội dung') || t.includes('noi dung')) return 'NOI_DUNG';
  if (t.includes('duyệt') || t.includes('duyet')) return 'DUYET_BAI';
  if (t.includes('ban điều hành') || t.includes('bdh') || t.includes('điều hành')) return 'GLOBAL';
  return '';
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
  await s.ensureTable(USERS_TAB, require('./schema').SCHEMA.USERS);
  const rows = await s.list(USERS_TAB);
  return rows.find(r => String(r.EMAIL || '').toLowerCase() === String(email || '').toLowerCase()) || null;
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
      return await readRankingMembers(sheets);
    } catch (e) {
      console.warn('[YNDA] ranking lookup failed:', e.message);
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

async function ensureUserSheetInner(uid, email, name, firebaseProfile) {
  const s = store.store();
  await s.ensureTable(USERS_TAB, require('./schema').SCHEMA.USERS);
  let user = await findUserByEmail(email);

  if (user && user.STATUS === 'ARCHIVED') {
    const err = new Error('Tài khoản đã bị vô hiệu hóa.');
    err.code = 'ARCHIVED';
    throw err;
  }

  if (!user) {
    // Lần đầu đăng nhập bằng Firebase -> tra role từ sheet ranking
    let role = '';
    let department = '';
    try {
      const members = await module.exports.readRankingMembersCached();
      const match = members.find(m => m.email === String(email).toLowerCase());
      role = match ? match.role : '';
      department = match ? (match.department || departmentFromName(match.name)) : 'GLOBAL';
    } catch (e) {
      console.warn('[YNDA] ranking lookup failed:', e.message);
    }

    if (!role) role = 'MEMBER';
    if (!department) department = 'GLOBAL';

    const userId = store.uid('USR');
    user = {
      USER_ID: userId,
      NAME: name || (firebaseProfile && firebaseProfile.name) || email.split('@')[0],
      EMAIL: String(email || '').toLowerCase(),
      ROLE: config.normalizeRole(role),
      DEPARTMENT: department,
      SEASON_ID: '',
      STATUS: 'ACTIVE',
      PHONE: (firebaseProfile && firebaseProfile.phoneNumber) || '',
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
    // Tự healing: xoá mọi bản khác cùng email, giữ lại bản vừa tạo.
    try {
      const again = await s.list(USERS_TAB);
      const dups = again.filter(r => String(r.EMAIL || '').toLowerCase() === String(email || '').toLowerCase() && r.USER_ID !== user.USER_ID);
      for (const d of dups) await s.remove(USERS_TAB, 'USER_ID', d.USER_ID);
      if (dups.length) console.warn(`[YNDA] heal: xoá ${dups.length} user trùng ${email}`);
    } catch (e) { console.warn('[YNDA] heal failed:', e.message); }
  } else {
    // User đã tồn tại: cập nhật UID + role/department từ ranking nếu cần
    // (user firebase-auth/ranking-sync được quản tự động; user manual giữ nguyên)
    const autoManaged = ['firebase-auth', 'ranking-sync'].includes(String(user.CREATED_BY || ''));
    const patch = {};
    if (uid && (!user.FIREBASE_UID || !autoManaged)) patch.FIREBASE_UID = uid;
    if (name && !user.NAME) patch.NAME = name;
    if (autoManaged) {
      try {
const members = await module.exports.readRankingMembersCached();
        const match = members.find(m => m.email === String(email).toLowerCase());
        if (match) {
          const wantRole = config.normalizeRole(match.role) || 'MEMBER';
          const wantDept = match.department || departmentFromName(match.name) || 'GLOBAL';
          if (user.ROLE !== wantRole) patch.ROLE = wantRole;
          if (user.DEPARTMENT !== wantDept) patch.DEPARTMENT = wantDept;
          if ((match.name || '') && !user.NAME) patch.NAME = match.name;
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
  await s.ensureTable(USERS_TAB, require('./schema').SCHEMA.USERS);
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
  await s.ensureTable(USERS_TAB, require('./schema').SCHEMA.USERS);
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
  const rows = await s.list(USERS_TAB);
  const u = rows.find(r => String(r.FIREBASE_UID || '') === String(uid || ''));
  return sanitizeUser(u);
}

async function listUsers(filter = {}) {
  const s = store.store();
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
  const user = await findUserByEmail(email)
    .then(async u => {
      if (u) return u;
      try {
        return await ensureUserSheet(decoded.uid, email, decoded.name, decoded);
      } catch (e) { return null; }
    });
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
  readRankingMembers, mapRankingRole, departmentFromName, syncUsersFromRanking,
  readRankingMembersCached, ensureUserSheet
};