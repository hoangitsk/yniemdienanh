const { google } = require('googleapis');

let authCache = null;
function getAuth() {
  if (authCache) return authCache;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (!key) throw new Error('GOOGLE_SERVICE_ACCOUNT chưa được cấu hình');
  const credentials = JSON.parse(key);
  authCache = new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
  return authCache;
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

async function clearRange(spreadsheetId, range) {
  await sheets().spreadsheets.values.clear({ spreadsheetId, range });
}

async function batchUpdate(spreadsheetId, requests) {
  const res = await sheets().spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
  return res.data;
}

const COLORS = {
  darkGold: { red: 0.8, green: 0.58, blue: 0.26 },
  lightGold: { red: 0.95, green: 0.82, blue: 0.53 },
  darkBg: { red: 0.05, green: 0.05, blue: 0.05 },
  mediumBg: { red: 0.1, green: 0.1, blue: 0.1 },
  lightBg: { red: 0.15, green: 0.15, blue: 0.15 },
  white: { red: 1, green: 1, blue: 1 },
  textLight: { red: 0.88, green: 0.88, blue: 0.88 },
  textDark: { red: 0.05, green: 0.05, blue: 0.05 },
  green: { red: 0.2, green: 0.6, blue: 0.2 },
  red: { red: 0.7, green: 0.2, blue: 0.2 },
  orange: { red: 0.9, green: 0.5, blue: 0.1 },
  blue: { red: 0.2, green: 0.4, blue: 0.8 },
};

function headerRow(sheetId, colCount, startRow) {
  return {
    repeatCell: {
      range: { sheetId, startRowIndex: startRow, endRowIndex: startRow + 1 },
      cell: {
        userEnteredFormat: {
          backgroundColor: COLORS.darkGold,
          textFormat: { bold: true, foregroundColor: COLORS.textDark, fontSize: 10 },
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
          borders: {
            bottom: { style: 'SOLID_MEDIUM', color: COLORS.lightGold },
          },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,borders)',
    },
  };
}

function freezeRows(sheetId, rowCount) {
  return { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: rowCount } }, fields: 'gridProperties.frozenRowCount' } };
}

function setAutoFilter(sheetId, colCount, rowCount) {
  return {
    setBasicFilter: {
      filter: {
        range: { sheetId, startRowIndex: 0, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: colCount },
      },
    },
  };
}

function setColumnWidths(sheetId, widths) {
  return widths.map((w, i) => ({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
      properties: { pixelSize: w },
      fields: 'pixelSize',
    },
  }));
}

function dataRows(sheetId, startRow, endRow, colCount) {
  return {
    repeatCell: {
      range: { sheetId, startRowIndex: startRow, endRowIndex: endRow, startColumnIndex: 0, endColumnIndex: colCount },
      cell: {
        userEnteredFormat: {
          backgroundColor: COLORS.mediumBg,
          textFormat: { foregroundColor: COLORS.textLight, fontSize: 9 },
          verticalAlignment: 'MIDDLE',
          wrapStrategy: 'WRAP',
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy)',
    },
  };
}

function alternatingRows(sheetId, startRow, endRow, colCount) {
  const requests = [];
  for (let r = startRow; r < endRow; r++) {
    if (r % 2 === 0) continue;
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: colCount },
        cell: { userEnteredFormat: { backgroundColor: COLORS.darkBg } },
        fields: 'userEnteredFormat.backgroundColor',
      },
    });
  }
  return requests;
}

const STATUS_STYLES = {
  'confirmed': { backgroundColor: COLORS.green, textFormat: { bold: true, foregroundColor: COLORS.white, fontSize: 9 } },
  'completed': { backgroundColor: COLORS.blue, textFormat: { bold: true, foregroundColor: COLORS.white, fontSize: 9 } },
  'cancelled': { backgroundColor: COLORS.red, textFormat: { bold: true, foregroundColor: COLORS.white, fontSize: 9 } },
  'pending': { backgroundColor: COLORS.orange, textFormat: { bold: true, foregroundColor: COLORS.white, fontSize: 9 } },
  'open': { backgroundColor: { red: 0.15, green: 0.35, blue: 0.15 }, textFormat: { bold: true, foregroundColor: COLORS.white, fontSize: 9 } },
  'draft': { backgroundColor: { red: 0.3, green: 0.3, blue: 0.3 }, textFormat: { bold: true, foregroundColor: COLORS.textLight, fontSize: 9 } },
  'SCHEDULE_CONFIRMED': { backgroundColor: COLORS.green, textFormat: { bold: true, foregroundColor: COLORS.white, fontSize: 9 } },
  'completed': { backgroundColor: COLORS.blue, textFormat: { bold: true, foregroundColor: COLORS.white, fontSize: 9 } },
};

async function ensureSheet(spreadsheetId, title, colCount) {
  const ss = await sheets().spreadsheets.get({ spreadsheetId });
  const existing = ss.data.sheets.find(s => s.properties.title === title);
  if (existing) return existing.properties.sheetId;

  const res = await sheets().spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        addSheet: {
          properties: { title, gridProperties: { frozenRowCount: 1, columnCount: colCount } },
        },
      }],
    },
  });
  return res.data.replies[0].addSheet.properties.sheetId;
}

async function writeTable(spreadsheetId, sheetTitle, headers, rows, statusColIndex) {
  const colCount = headers.length;
  const sheetId = await ensureSheet(spreadsheetId, sheetTitle, colCount);

  await clearRange(spreadsheetId, `${sheetTitle}!A1:ZZ99999`);

  const values = [headers, ...rows];
  await appendRows(spreadsheetId, `${sheetTitle}!A1`, values);

  const dataRowCount = values.length;
  const requests = [
    freezeRows(sheetId, 1),
    setAutoFilter(sheetId, colCount, dataRowCount),
    headerRow(sheetId, colCount, 0),
    ...setColumnWidths(sheetId, [120, 200, 180, 100, 120, 100, 300, 150, 120, 150, 100, 80].slice(0, colCount)),
  ];

  if (dataRowCount > 1) {
    requests.push(dataRows(sheetId, 1, dataRowCount, colCount));
    requests.push(...alternatingRows(sheetId, 1, dataRowCount, colCount));

    if (statusColIndex >= 0) {
      for (let r = 1; r < dataRowCount; r++) {
        const val = rows[r - 1][statusColIndex] || '';
        const style = STATUS_STYLES[val.toLowerCase()] || STATUS_STYLES[val];
        if (style) {
          requests.push({
            repeatCell: {
              range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: statusColIndex, endColumnIndex: statusColIndex + 1 },
              cell: { userEnteredFormat: style },
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          });
        }
      }
    }
  }

  if (requests.length) await batchUpdate(spreadsheetId, requests);
  return { sheetId, rowCount: dataRowCount };
}

module.exports = {
  ensureSheet,
  writeTable,
  appendRows,
  getRows,
  clearRange,
  batchUpdate,
};
