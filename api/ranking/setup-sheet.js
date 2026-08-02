const { google } = require('googleapis');

const RANKING_SHEET_ID = '1rFuGWw4IZxmROnP7W4k1ntEykstZZu0JP3mKexihR6E';

async function run() {
  const key = process.env.GOOGLE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!key) { console.error('❌ GOOGLE_SERVICE_ACCOUNT chưa được cấu hình'); process.exit(1); }

  let credentials;
  try {
    const { parseServiceAccount } = require('../../lib/googleSheetsFormatter');
    credentials = parseServiceAccount(key);
  } catch (e) {
    credentials = JSON.parse(key);
    if (typeof credentials === 'string') credentials = JSON.parse(credentials);
    if (credentials.private_key) credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  }

  const auth = new google.auth.JWT(
    credentials.client_email, null, credentials.private_key,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
  const sheets = google.sheets({ version: 'v4', auth });

  const spreadsheets = await sheets.spreadsheets.get({ spreadsheetId: RANKING_SHEET_ID });
  const existingTitles = spreadsheets.data.sheets.map(s => s.properties.title);
  console.log('Tabs hiện có:', existingTitles.join(', ') || '(trống)');

  const tabs = {
    'Thành viên': [
      'STT', 'Họ và tên', 'Ban', 'Vai trò', 'Email', 'SĐT', 'Ghi chú'
    ],
    'Điểm': [
      'STT', 'Họ và tên', 'Số điểm', 'Lý do', 'Ngày'
    ]
  };

  for (const [title, headers] of Object.entries(tabs)) {
    let sheetId = null;
    if (!existingTitles.includes(title)) {
      const addRes = await sheets.spreadsheets.batchUpdate({
        spreadsheetId: RANKING_SHEET_ID,
        requestBody: {
          requests: [{
            addSheet: { properties: { title, gridProperties: { frozenRowCount: 1, columnCount: headers.length } } }
          }]
        }
      });
      sheetId = addRes.data.replies[0].addSheet.properties.sheetId;
      console.log(`✅ Đã tạo tab "${title}"`);
    } else {
      const sheet = spreadsheets.data.sheets.find(s => s.properties.title === title);
      sheetId = sheet.properties.sheetId;
      console.log(`ℹ️  Tab "${title}" đã tồn tại`);
    }

    const safeTitle = `'${title.replace(/'/g, "''")}'`;
    const valuesRes = await sheets.spreadsheets.values.get({
      spreadsheetId: RANKING_SHEET_ID,
      range: `${safeTitle}!A1:Z1`
    }).catch(() => null);
    const hasHeader = valuesRes && valuesRes.data.values && valuesRes.data.values.length > 0;

    if (!hasHeader) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: RANKING_SHEET_ID,
        range: `${safeTitle}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [headers] }
      });
      console.log(`✅ Đã ghi header cho tab "${title}"`);
    }

    // Định dạng header và độ rộng cột
    const formatRequests = [];
    formatRequests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: headers.length },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.8, green: 0.58, blue: 0.26 },
            textFormat: { bold: true, foregroundColor: { red: 0.05, green: 0.05, blue: 0.05 }, fontSize: 10 },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE'
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
      }
    });
    headers.forEach((h, i) => {
      formatRequests.push({
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
          properties: { pixelSize: i === 1 ? 200 : 140 },
          fields: 'pixelSize'
        }
      });
    });
    try {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId: RANKING_SHEET_ID, requestBody: { requests: formatRequests } });
    } catch (e) {
      console.warn(`Format tab "${title}" bỏ qua:`, e.message);
    }
  }

  console.log('');
  console.log('✅ Xong! Sheet đã sẵn sàng để nhập liệu.');
  console.log(`🔗 https://docs.google.com/spreadsheets/d/${RANKING_SHEET_ID}`);
  console.log('');
  console.log('Hướng dẫn nhập liệu:');
  console.log('- Tab "Thành viên": STT | Họ và tên | Ban | Vai trò (Core hoặc Thành viên) | Email | SĐT | Ghi chú');
  console.log('- Tab "Điểm": STT | Họ và tên | Số điểm | Lý do | Ngày. Mỗi lần cộng điểm ghi 1 dòng.');
}

run().catch(err => { console.error('❌', err.message); process.exit(1); });
