const { google } = require('googleapis');

function getAuth() {
  let key = process.env.GOOGLE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!key) throw new Error('GOOGLE_SERVICE_ACCOUNT hoặc FIREBASE_SERVICE_ACCOUNT chưa được cấu hình');
  let credentials;
  try {
    if (typeof key === 'string' && key.startsWith('"') && key.endsWith('"')) key = key.slice(1, -1);
    credentials = typeof key === 'object' ? key : JSON.parse(key);
    if (typeof credentials === 'string') credentials = JSON.parse(credentials);
    if (credentials.private_key) credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  } catch (e) {
    throw new Error('Lỗi giải mã Service Account JSON: ' + e.message);
  }
  return new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
}

function sheets() {
  return google.sheets({ version: 'v4', auth: getAuth() });
}

async function appendRows(spreadsheetId, range, values) {
  const res = await sheets().spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
  return res.data;
}

async function getRows(spreadsheetId, range) {
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  return res.data.values || [];
}

async function updateRow(spreadsheetId, range, values) {
  const res = await sheets().spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
  return res.data;
}

async function clearRange(spreadsheetId, range) {
  const res = await sheets().spreadsheets.values.clear({
    spreadsheetId,
    range,
  });
  return res.data;
}

async function batchGet(spreadsheetId, ranges) {
  const res = await sheets().spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
  });
  return res.data.valueRanges || [];
}

module.exports = { appendRows, getRows, updateRow, clearRange, batchGet };
