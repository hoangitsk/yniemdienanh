'use strict';

// =============================================================================
// YNDA SETUP — tạo Google Sheets (tabs) + Google Drive (cây thư mục)
// -----------------------------------------------------------------------------
// Chạy: npm run ynda:setup
// Yêu cầu env: GOOGLE_SERVICE_ACCOUNT (hoặc FIREBASE_SERVICE_ACCOUNT) và
// YNDA_SPREADSHEET_ID (hoặc SPREADSHEET_YNDA), YNDA_DRIVE_ROOT (tùy chọn).
// =============================================================================

const { parseServiceAccount } = require('../lib/ynda/store');
const { SCHEMA } = require('../lib/ynda/schema');
const config = require('../lib/ynda/config');

async function setupSpreadsheet(google, credentials) {
  const auth = new google.auth.JWT(
    credentials.client_email, null, credentials.private_key,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
  const sheets = google.sheets({ version: 'v4', auth });

  // Keep operations data in the same spreadsheet used by Ranking.
  let sid = process.env.SPREADSHEET_RANKING || process.env.YNDA_SPREADSHEET_ID || process.env.SPREADSHEET_YNDA;
  if (!sid) {
    // Tạo spreadsheet mới
    const created = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: 'YNDA OPERATIONS DATABASE',
          locale: 'vi_VN',
          timeZone: 'Asia/Ho_Chi_Minh',
        },
      },
    });
    sid = created.data.spreadsheetId;
    console.log('✅ Đã tạo spreadsheet mới:', created.data.spreadsheetUrl);
  } else {
    console.log('ℹ️  Dùng spreadsheet ID:', sid);
    // Xác nhận spreadsheet tồn tại
    await sheets.spreadsheets.get({ spreadsheetId: sid }).catch(() => {
      throw new Error('Không tìm thấy spreadsheet với ID đã cấu hình.');
    });
  }

  // Kiểm tra các tab hiện tại
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sid });
  const existingTitles = new Set(meta.data.sheets.map(s => s.properties.title));

  const missing = [];
  for (const [tabName, headers] of Object.entries(SCHEMA)) {
    if (!existingTitles.has(tabName)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sid,
        requestBody: {
          requests: [{
            addSheet: {
              properties: { title: tabName, gridProperties: { frozenRowCount: 1, columnCount: headers.length } },
            },
          }],
        },
      });
      // ghi header
      await sheets.spreadsheets.values.update({
        spreadsheetId: sid,
        range: `'${tabName}'!A1:${columnLetter(headers.length)}1`,
        valueInputOption: 'RAW',
        requestBody: { values: [headers] },
      });
      missing.push(tabName);
    }
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sid,
    requestBody: {
      requests: [
        { updateSheetProperties: { properties: { sheetId: meta.data.sheets[0].properties.sheetId, title: 'CONFIG' }, fields: 'title' } },
      ],
    },
  }).catch(() => {});

  console.log(missing.length
    ? `✅ Đã tạo ${missing.length} tab: ${missing.join(', ')}`
    : 'ℹ️  Tất cả tab đã tồn tại.');
  return sid;
}

function columnLetter(n) {
  let out = '';
  while (n > 0) {
    n -= 1;
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26);
  }
  return out;
}

async function setupDrive(google, credentials) {
  const auth = new google.auth.JWT(
    credentials.client_email, null, credentials.private_key,
    ['https://www.googleapis.com/auth/drive']
  );
  const drive = google.drive({ version: 'v3', auth });

  const ensureFolder = async (parentId, name) => {
    const q = `'${parentId}' in parents and name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const res = await drive.files.list({ q, fields: 'files(id, name)', pageSize: 1 });
    if (res.data.files && res.data.files.length) return res.data.files[0].id;
    const created = await drive.files.create({
      requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
      fields: 'id',
    });
    return created.data.id;
  };

  let rootId = process.env.YNDA_DRIVE_ROOT || '';
  if (rootId && !/^[a-zA-Z0-9_-]+$/.test(rootId)) {
    const m = rootId.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (m) rootId = m[1];
  }
  if (!rootId) {
    const res = await drive.files.list({ q: "name = 'YNDA DRIVE' and mimeType = 'application/vnd.google-apps.folder' and trashed = false", fields: 'files(id, name)', pageSize: 1 });
    if (res.data.files && res.data.files.length) rootId = res.data.files[0].id;
    else {
      const created = await drive.files.create({ requestBody: { name: 'YNDA DRIVE', mimeType: 'application/vnd.google-apps.folder' }, fields: 'id' });
      rootId = created.data.id;
    }
  }
  console.log('🗂  Drive root:', rootId);

  // TAGS/SEASONS + TASKS/<ban> + PRODUCTION
  const tasksRoot = await ensureFolder(rootId, 'TASKS');
  const created = ['GLOBAL', 'DUYET_BAI', 'MEDIA', 'NOI_DUNG', 'NHAN_SU', 'TRUYEN_THONG'].map(d => ensureFolder(tasksRoot, d));
  const seasonsRoot = await ensureFolder(rootId, 'SEASONS');
  await ensureFolder(seasonsRoot, 'S01');
  await ensureFolder(rootId, 'PRODUCTION');
  await Promise.all(created);
  console.log('✅ Đã đảm bảo cây thư mục Drive: SEASONS/S01, TASKS/<6 ban>, PRODUCTION');
  return rootId;
}

async function run() {
  const key = process.env.GOOGLE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!key) {
    console.error('❌ Cần cấu hình GOOGLE_SERVICE_ACCOUNT hoặc FIREBASE_SERVICE_ACCOUNT.');
    process.exit(1);
  }
  const credentials = parseServiceAccount(key);
  const { google } = require('googleapis');

  const sid = await setupSpreadsheet(google, credentials);
  console.log('🔗 Spreadsheet:', `https://docs.google.com/spreadsheets/d/${sid}`);

  if (process.env.YNDA_SETUP_DRIVE === '1') {
    const rootId = await setupDrive(google, credentials);
    console.log('🔗 Drive root:', `https://drive.google.com/drive/folders/${rootId}`);
  } else {
    console.log('ℹ️  Bỏ qua Drive. Đặt YNDA_SETUP_DRIVE=1 để tạo cây thư mục Google Drive.');
  }
  console.log('\n✅ Setup hoàn tất.');
}

run().catch(err => { console.error('❌', err.message); process.exit(1); });
