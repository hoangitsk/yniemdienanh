const { google } = require('googleapis');

async function run() {
  const key = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (!key) { console.error('❌ GOOGLE_SERVICE_ACCOUNT chưa được cấu hình'); process.exit(1); }

  const credentials = JSON.parse(key);
  const auth = new google.auth.JWT(
    credentials.client_email, null, credentials.private_key,
    ['https://www.googleapis.com/auth/spreadsheets']
  );

  const sheets = google.sheets({ version: 'v4', auth });

  // Tạo spreadsheet mới
  const createRes = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: 'YNDA - HR Dashboard',
        locale: 'vi_VN',
        timeZone: 'Asia/Ho_Chi_Minh',
      },
      sheets: [
        { properties: { title: 'Ứng viên', gridProperties: { frozenRowCount: 1 } } },
        { properties: { title: 'Lịch PV', gridProperties: { frozenRowCount: 1 } } },
        { properties: { title: 'Staff Points', gridProperties: { frozenRowCount: 1 } } },
        { properties: { title: 'Nhật ký', gridProperties: { frozenRowCount: 1 } } },
      ],
    },
  });

  const sid = createRes.data.spreadsheetId;
  const url = createRes.data.spreadsheetUrl;

  console.log(`✅ Đã tạo spreadsheet: ${url}`);
  console.log(`📌 Spreadsheet ID: ${sid}`);
  console.log('');
  console.log('👉 Thêm dòng này vào .env:');
  console.log(`SPREADSHEET_HR_DASHBOARD=${sid}`);
}

run().catch(err => { console.error('❌', err.message); process.exit(1); });
