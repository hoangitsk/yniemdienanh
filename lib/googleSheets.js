const { google } = require('googleapis');

function parseServiceAccount(rawKey) {
  if (!rawKey) return null;
  if (typeof rawKey === 'object') return rawKey;

  let str = String(rawKey).trim();

  while ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }

  if (str.includes('\\"')) {
    str = str.replace(/\\"/g, '"');
  }

  if (!str.startsWith('{') && (str.startsWith('ey') || str.endsWith('='))) {
    try {
      const decoded = Buffer.from(str, 'base64').toString('utf8');
      if (decoded.trim().startsWith('{')) str = decoded.trim();
    } catch (e) {}
  }

  let parsed = null;
  try {
    parsed = JSON.parse(str);
  } catch (e) {
    const startIdx = str.indexOf('{');
    const endIdx = str.lastIndexOf('}');
    if (startIdx !== -1 && endIdx > startIdx) {
      const jsonSubstring = str.substring(startIdx, endIdx + 1);
      parsed = JSON.parse(jsonSubstring);
    } else {
      throw e;
    }
  }

  if (typeof parsed === 'string') {
    return parseServiceAccount(parsed);
  }

  if (parsed && parsed.private_key) {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  }

  return parsed;
}

function getAuth() {
  let key = process.env.GOOGLE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!key) throw new Error('GOOGLE_SERVICE_ACCOUNT hoặc FIREBASE_SERVICE_ACCOUNT chưa được cấu hình');
  let credentials;
  try {
    credentials = parseServiceAccount(key);
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
