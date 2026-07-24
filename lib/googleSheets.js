const { google } = require('googleapis');

function getAuth() {
  const key = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (!key) throw new Error('GOOGLE_SERVICE_ACCOUNT chưa được cấu hình');
  const credentials = JSON.parse(key);
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
