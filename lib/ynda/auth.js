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

async function ensureUserSheet(uid, email, name, firebaseProfile) {
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
      const { google } = require('googleapis');
      const cred = require('../../lib/ynda/store').parseServiceAccount(
        process.env.GOOGLE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT
      );
      const auth = new google.auth.JWT(cred.client_email, null, cred.private_key,
        ['https://www.googleapis.com/auth/spreadsheets.readonly']);
      const sheets = google.sheets({ version: 'v4', auth });
      const members = await readRankingMembers(sheets);
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
  } else {
    // Cập nhật UID Firebase + thông tin cơ bản nếu thiếu
    const patch = {};
    if (uid && !user.FIREBASE_UID) patch.FIREBASE_UID = uid;
    if (name && !user.NAME) patch.NAME = name;
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
    const { google } = require('googleapis');
    const cred = require('../../lib/ynda/store').parseServiceAccount(
      process.env.GOOGLE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT
    );
    const sheetsAuth = new google.auth.JWT(cred.client_email, null, cred.private_key,
      ['https://www.googleapis.com/auth/spreadsheets.readonly']);
    const sheets = google.sheets({ version: 'v4', auth: sheetsAuth });
    members = await readRankingMembers(sheets);
  }
  if (!members || !members.length) throw new Error('Không đọc được dữ liệu thành viên từ sheet ranking.');

  const existing = await s.list(USERS_TAB);
  let created = 0, updated = 0;
  for (const m of members) {
    const cur = existing.find(u => String(u.EMAIL || '').toLowerCase() === m.email);
    if (!cur) {
      const userId = store.uid('USR');
      await s.insert(USERS_TAB, {
        USER_ID: userId,
        NAME: m.name || m.email.split('@')[0],
        EMAIL: m.email,
        ROLE: config.normalizeRole(m.role),
        DEPARTMENT: m.department || 'GLOBAL',
        SEASON_ID: '',
        STATUS: 'ACTIVE',
        PHONE: m.phone || '',
        AVATAR: '',
        PASSWORD_HASH: '',
        FIREBASE_UID: '',
        JOINED_AT: new Date().toISOString(),
        CREATED_BY: 'ranking-sync',
        CREATED_AT: new Date().toISOString(),
        UPDATED_AT: new Date().toISOString()
      });
      created++;
    } else {
      const patch = {};
      const shouldSyncName = m.name && (!cur.NAME || cur.CREATED_BY === 'ranking-sync');
      if (shouldSyncName && cur.NAME !== m.name) patch.NAME = m.name;
      if (cur.ROLE !== config.normalizeRole(m.role)) patch.ROLE = config.normalizeRole(m.role);
      if (m.department && cur.DEPARTMENT !== m.department) patch.DEPARTMENT = m.department;
      if (m.phone && cur.PHONE !== m.phone) patch.PHONE = m.phone;
      if (Object.keys(patch).length) {
        await s.update(USERS_TAB, 'USER_ID', cur.USER_ID, { ...patch, UPDATED_AT: new Date().toISOString() });
        updated++;
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
  readRankingMembers, mapRankingRole, departmentFromName, syncUsersFromRanking
};