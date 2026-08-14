const fs = require('fs');
const path = require('path');
const { parseServiceAccount } = require('../lib/googleSheets');
const { google } = require('googleapis');
const authHelper = require('../lib/ynda/auth');

function getServiceAccount() {
  const candidates = ['.env.prod.ranking', '.env.local.ranking', '.env.local', '.env'];
  for (const f of candidates) {
    if (fs.existsSync(f)) {
      const content = fs.readFileSync(f, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('GOOGLE_SERVICE_ACCOUNT=') || trimmed.startsWith('FIREBASE_SERVICE_ACCOUNT=')) {
          const raw = trimmed.substring(trimmed.indexOf('=') + 1);
          const parsed = parseServiceAccount(raw);
          if (parsed && parsed.client_email) {
            console.log('Found service account in', f);
            return parsed;
          }
        }
      }
    }
  }
  return null;
}

async function testSheetAccess() {
  const sid = '1SgbkoiSXP_zNYWN_AC6WKXTGQPbRAHfs2gwv_NOnsJM';
  console.log('Testing access to sheet:', sid);

  const creds = getServiceAccount();
  if (!creds) {
    console.error('❌ Không tìm thấy thông tin Service Account trong các file .env');
    return;
  }

  console.log('🔑 Service Account Client Email:', creds.client_email);
  console.log('📁 Project ID:', creds.project_id);

  try {
    const authClient = new google.auth.JWT(
      creds.client_email,
      null,
      creds.private_key,
      ['https://www.googleapis.com/auth/spreadsheets.readonly']
    );

    const sheetsApi = google.sheets({ version: 'v4', auth: authClient });

    // 1. Get spreadsheet metadata (tabs)
    console.log('🔍 Đang kiểm tra quyền truy cập Sheet...');
    const meta = await sheetsApi.spreadsheets.get({ spreadsheetId: sid });
    console.log('✅ Kết nối thành công tới Sheet:', meta.data.properties.title);
    console.log('📑 Các tab hiện có trong Sheet:');
    meta.data.sheets.forEach(s => {
      console.log('   - ' + s.properties.title + ' (gid: ' + s.properties.sheetId + ')');
    });

    // 2. Read members using authHelper
    console.log('📊 Đang đọc danh sách thành viên qua authHelper.readRankingMembers...');
    const members = await authHelper.readRankingMembers(sheetsApi, sid);
    console.log('✅ Đọc thành công ' + members.length + ' thành viên:');
    members.slice(0, 10).forEach((m, idx) => {
      console.log(`   ${idx + 1}. [${m.role}] ${m.name} - Ban: ${m.ban || 'N/A'} - Chức vụ: ${m.rawRole || 'N/A'} (Tab: ${m.tab})`);
    });
  } catch (err) {
    console.error('❌ Lỗi kết nối Google Sheets:');
    console.error('   Mã lỗi (Code):', err.code || (err.response && err.response.status));
    console.error('   Thông điệp (Message):', err.message);
    if (err.code === 403 || (err.response && err.response.status === 403)) {
      console.error('\n⚠️ NGUYÊN NHÂN: Google Sheet chưa được chia sẻ quyền xem/chỉnh sửa cho email Service Account:');
      console.error('👉 Hãy mở Sheet -> Bấm nút "Chia sẻ" (Share) -> Thêm email sau với quyền "Người xem" (Viewer) hoặc "Người chỉnh sửa" (Editor):');
      console.error('👉 EMAIL:', creds.client_email);
    } else if (err.code === 404 || (err.response && err.response.status === 404)) {
      console.error('\n⚠️ NGUYÊN NHÂN: Không tìm thấy Spreadsheet ID hoặc Sheet không tồn tại.');
    }
  }
}

testSheetAccess();
