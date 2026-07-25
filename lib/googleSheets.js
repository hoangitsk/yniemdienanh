const { google } = require('googleapis');

function parseServiceAccount(rawKey) {
  if (!rawKey) return null;
  if (typeof rawKey === 'object') return rawKey;

  let str = String(rawKey).trim().replace(/^\uFEFF/, '').replace(/[\u200B-\u200D\uFEFF]/g, '');

  while ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }

  if (str.includes('\\"') && !str.includes('{\n') && !str.includes('{\r')) {
    str = str.replace(/\\"/g, '"');
  }

  if (!str.startsWith('{') && (str.startsWith('ey') || str.endsWith('='))) {
    try {
      const decoded = Buffer.from(str, 'base64').toString('utf8');
      if (decoded.trim().startsWith('{')) str = decoded.trim();
    } catch (e) {}
  }

  try {
    const obj = JSON.parse(str);
    if (typeof obj === 'object' && obj !== null) {
      if (obj.private_key) obj.private_key = obj.private_key.replace(/\\n/g, '\n');
      return obj;
    }
    if (typeof obj === 'string') return parseServiceAccount(obj);
  } catch (e1) {}

  // Multi-line return character sanitizer (for private_key pasted with real newlines)
  let sanitized = str.replace(/("private_key"\s*:\s*")([\s\S]*?)("\s*,)/g, (match, p1, p2, p3) => {
    return p1 + p2.replace(/\r?\n/g, '\\n') + p3;
  });

  try {
    const obj = JSON.parse(sanitized);
    if (typeof obj === 'object' && obj !== null) {
      if (obj.private_key) obj.private_key = obj.private_key.replace(/\\n/g, '\n');
      return obj;
    }
  } catch (e2) {}

  const startIdx = sanitized.indexOf('{');
  if (startIdx !== -1) {
    let braceCount = 0;
    let inString = false;
    let isEscaped = false;
    let endIdx = -1;

    for (let i = startIdx; i < sanitized.length; i++) {
      const char = sanitized[i];
      if (isEscaped) {
        isEscaped = false;
        continue;
      }
      if (char === '\\') {
        isEscaped = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === '{') braceCount++;
        else if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            endIdx = i;
            break;
          }
        }
      }
    }

    if (endIdx !== -1) {
      let snippet = sanitized.substring(startIdx, endIdx + 1);
      try {
        const obj = JSON.parse(snippet);
        if (typeof obj === 'object' && obj !== null) {
          if (obj.private_key) obj.private_key = obj.private_key.replace(/\\n/g, '\n');
          return obj;
        }
      } catch (e3) {}
    }
  }

  throw new Error('Không thể giải mã JSON. Vui lòng kiểm tra lại chuỗi Service Account dán trên Vercel');
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
