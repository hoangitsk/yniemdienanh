'use strict';

// =============================================================================
// YNDA GOOGLE DRIVE LAYER (XXXIV)
// -----------------------------------------------------------------------------
// Google Drive dùng để lưu: Instructions, Submission, Proof, các phiên bản
// submission, file Approved, file Production, tài liệu liên quan.
//
// Cấu trúc:
//   YNDA DRIVE
//     SEASONS/S01
//     TASKS/{GLOBAL|DUYET_BAI|MEDIA|NOI_DUNG|NHAN_SU|TRUYEN_THONG}/TASK-CODE/
//       Instructions | Submissions/User_A/v1..v2 | Approved
//     PRODUCTION
// Không xóa submission cũ.
// =============================================================================

const { parseServiceAccount } = require('./store');

function parseId(val) {
  if (val && typeof val === 'string' && val.includes('/folders/')) {
    const m = val.match(/\/folders\/([a-zA-Z0-9-_]+)/);
    if (m) return m[1];
  }
  if (val && typeof val === 'string' && val.includes('/d/')) {
    const m = val.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (m) return m[1];
  }
  return val ? String(val).trim() : '';
}

function getDriveAuth() {
  const key = process.env.GOOGLE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!key) throw new Error('GOOGLE_SERVICE_ACCOUNT chưa được cấu hình.');
  const credentials = parseServiceAccount(key);
  const { google } = require('googleapis');
  return new google.auth.JWT(
    credentials.client_email, null, credentials.private_key,
    ['https://www.googleapis.com/auth/drive']
  );
}

function drive() {
  const { google } = require('googleapis');
  return google.drive({ version: 'v3', auth: getDriveAuth() });
}

let rootFolderCache = null;
async function ensureRootFolder() {
  if (rootFolderCache) return rootFolderCache;
  const envRoot = parseId(process.env.YNDA_DRIVE_ROOT);
  if (envRoot) { rootFolderCache = envRoot; return envRoot; }

  // tìm folder "YNDA DRIVE"
  const res = await drive().files.list({
    q: "name = 'YNDA DRIVE' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    fields: 'files(id, name)'
  });
  if (res.data.files && res.data.files.length) {
    rootFolderCache = res.data.files[0].id;
    return rootFolderCache;
  }
  // tạo mới
  const created = await drive().files.create({
    requestBody: { name: 'YNDA DRIVE', mimeType: 'application/vnd.google-apps.folder' },
    fields: 'id'
  });
  rootFolderCache = created.data.id;
  return rootFolderCache;
}

async function ensureFolder(parentId, name) {
  const q = `'${parentId}' in parents and name = '${String(name).replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const res = await drive().files.list({ q, fields: 'files(id, name)', pageSize: 1 });
  if (res.data.files && res.data.files.length) return res.data.files[0].id;
  const created = await drive().files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id'
  });
  return created.data.id;
}

// Tạo cây thư mục cho task, trả { root, instructions, submissions, approved }
async function createTaskFolder({ taskCode, department, seasonCode }) {
  const root = await ensureRootFolder();
  const seasons = await ensureFolder(root, 'SEASONS');
  const season = await ensureFolder(seasons, seasonCode || 'S01');
  const tasksRoot = await ensureFolder(root, 'TASKS');
  const dept = await ensureFolder(tasksRoot, department || 'GLOBAL');
  const taskRoot = await ensureFolder(dept, taskCode);
  const instructions = await ensureFolder(taskRoot, 'Instructions');
  const submissions = await ensureFolder(taskRoot, 'Submissions');
  const approved = await ensureFolder(taskRoot, 'Approved');
  return { root, taskRoot, instructions, submissions, approved };
}

async function ensureUserSubfolder(submissionsParent, userName) {
  return ensureFolder(submissionsParent, userName);
}

async function ensureVersionFolder(userFolder, version) {
  return ensureFolder(userFolder, version || 'v1');
}

// Upload file lên Drive, trả file id + webViewLink + name
async function uploadFile({ folderId, fileName, mimeType, bodyBase64 }) {
  const res = await drive().files.create({
    requestBody: { name: fileName, mimeType: mimeType || 'application/octet-stream', parents: [folderId] },
    media: { mimeType: mimeType || 'application/octet-stream', body: bodyBase64 ? Buffer.from(bodyBase64, 'base64') : '' },
    fields: 'id, name, webViewLink, mimeType'
  });
  return { id: res.data.id, name: res.data.name, link: res.data.webViewLink, mimeType: res.data.mimeType };
}

// Liệt kê file trong folder (không xóa lịch sử — mọi version còn nguyên)
async function listFiles(folderId) {
  const res = await drive().files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, webViewLink, createdTime)',
    orderBy: 'createdTime'
  });
  return res.data.files || [];
}

module.exports = {
  ensureRootFolder, ensureFolder, createTaskFolder, ensureUserSubfolder,
  ensureVersionFolder, uploadFile, listFiles, drive
};