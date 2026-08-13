'use strict';

// =============================================================================
// YNDA STORE — Google Sheets as primary database
// -----------------------------------------------------------------------------
// Mọi dữ liệu nghiệp vụ chính được lưu trong Google Sheets (tabs).
// Store này cung cấp một interface đồng nhất (get/query/insert/update/delete)
// hoạt động trên Google Sheets trong production và trên một InMemoryStore
// trong môi trường dev/test (không có credentials).
//
// KHÔNG dùng Firebase Firestore/Realtime Database làm nơi lưu trữ chính.
// =============================================================================

const crypto = require('crypto');

// Số cột (1-based) -> chuỗi cột A, B, ... Z, AA, AB...
function colLetter(n) {
  let s = '';
  while (n > 0) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

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
    let braceCount = 0, inString = false, isEscaped = false, endIdx = -1;
    for (let i = startIdx; i < sanitized.length; i++) {
      const char = sanitized[i];
      if (isEscaped) { isEscaped = false; continue; }
      if (char === '\\') { isEscaped = true; continue; }
      if (char === '"') { inString = !inString; continue; }
      if (!inString) {
        if (char === '{') braceCount++;
        else if (char === '}') { braceCount--; if (braceCount === 0) { endIdx = i; break; } }
      }
    }
    if (endIdx !== -1) {
      try {
        const obj = JSON.parse(sanitized.substring(startIdx, endIdx + 1));
        if (typeof obj === 'object' && obj !== null) {
          if (obj.private_key) obj.private_key = obj.private_key.replace(/\\n/g, '\n');
          return obj;
        }
      } catch (e3) {}
    }
  }
  throw new Error('Không thể giải mã JSON. Vui lòng kiểm tra lại chuỗi Service Account.');
}

class SheetsStore {
  constructor({ spreadsheetId, serviceAccountKey }) {
    this.spreadsheetId = spreadsheetId;
    this.serviceAccountKey = serviceAccountKey;
    this.sheets = null;
    this._headerCache = {}; // tabName -> headers[]
    this._sheetIdCache = {}; // tabName -> sheetId
  }

  _auth() {
    const { google } = require('googleapis');
    const credentials = parseServiceAccount(this.serviceAccountKey);
    return new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      ['https://www.googleapis.com/auth/spreadsheets']
    );
  }

  _api() {
    if (this.sheets) return this.sheets;
    const { google } = require('googleapis');
    this.sheets = google.sheets({ version: 'v4', auth: this._auth() });
    return this.sheets;
  }

  _tab(tabName) {
    return `'${String(tabName).replace(/'/g, "''")}'`;
  }

  async _readRange(range) {
    const res = await this._api().spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range,
    });
    return res.data.values || [];
  }

  async _appendRows(range, values) {
    const res = await this._api().spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    });
    return res.data;
  }

  async _updateRange(range, values) {
    const res = await this._api().spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: { values },
    });
    return res.data;
  }

  async _clearRange(range) {
    await this._api().spreadsheets.values.clear({
      spreadsheetId: this.spreadsheetId,
      range,
    });
  }

  // Đọc header của tab (dòng 1). Nếu trống, tự ghi header.
  // Nếu đã có header nhưng thiếu cột theo schema, gộp thêm cột mới vào cuối
  // (1 lần, sau đó cache) — tránh mất dữ liệu như FIREBASE_UID bị bỏ sót.
  async _getHeaders(tabName, schemaHeaders) {
    const cacheKey = tabName;
    if (this._headerCache[cacheKey]) return this._headerCache[cacheKey];
    const rows = await this._readRange(`${this._tab(tabName)}!A1:ZZ1`).catch(() => []);
    let headers = (rows && rows[0]) || [];
    if (!headers.length) {
      headers = (schemaHeaders || []).slice();
      await this._appendRows(`${this._tab(tabName)}!A1`, [headers]);
    } else if (schemaHeaders && schemaHeaders.length) {
      const missing = schemaHeaders.filter(h => !headers.some(x => String(x) === String(h)));
      if (missing.length) {
        headers = headers.concat(missing);
        await this._updateRange(`${this._tab(tabName)}!A1:${colLetter(headers.length)}1`, [headers]);
      }
    }
    this._headerCache[cacheKey] = headers;
    return headers;
  }

  // Đọc toàn bộ rows của tab dưới dạng mảng objects (theo header).
  // Có cache trong bộ nhớ (TTL 3s) — mỗi request serverless thường xử lý
  // nhiều lần đọc cùng tab; tránh đọc quá quota của Google Sheets.
  async _readTable(tabName) {
    const now = Date.now();
    if (this._readCache && this._readCache[tabName] && now - this._readCache[tabName].at < 3000) {
      return this._readCache[tabName].rows;
    }
    const raw = await this._readRange(`${this._tab(tabName)}!A1:ZZ50000`);
    if (!raw.length) return [];
    const headers = raw[0];
    const rows = [];
    for (let i = 1; i < raw.length; i++) {
      const r = raw[i] || [];
      if (!r.some(c => String(c || '').trim() !== '')) continue;
      const obj = {};
      headers.forEach((h, idx) => {
        if (h) obj[String(h).trim()] = r[idx] == null ? '' : r[idx];
      });
      rows.push(obj);
    }
    if (!this._readCache) this._readCache = {};
    this._readCache[tabName] = { rows, at: now };
    return rows;
  }

  _invalidateCache(tabName) {
    if (this._readCache) delete this._readCache[tabName];
  }

  // Ghi lại TOÀN BỘ bảng từ 1 mốc (bỏ header): clear + append 1 lần.
  // Dùng cho cleanup/dedupe khi bảng hỏng (trùng, lệch cột) — chỉ 2 request.
  async _rebuildTable(tabName, rows) {
    const headers = await this._getHeaders(tabName, null);
    await this._clearRange(`${this._tab(tabName)}!A2:ZZ50000`);
    if (rows && rows.length) {
      const values = rows.map(r => headers.map(h => (r[h] == null || r[h] === undefined ? '' : (typeof r[h] === 'object' ? JSON.stringify(r[h]) : String(r[h])))));
      await this._appendRows(`${this._tab(tabName)}!A2`, values);
    }
    this._invalidateCache(tabName);
    return rows;
  }

  async ensureTable(tabName, schemaHeaders) {
    await this._getHeaders(tabName, schemaHeaders);
    return this;
  }

  async list(tabName) {
    return this._readTable(tabName);
  }

  async get(tabName, idField, idValue) {
    const rows = await this._readTable(tabName);
    const found = rows.find(r => String(r[idField] || '') === String(idValue));
    return found || null;
  }

  async query(tabName, predicate) {
    const rows = await this._readTable(tabName);
    return rows.filter(predicate);
  }

  async insert(tabName, record) {
    const headers = await this._getHeaders(tabName, Object.keys(record));
    const row = headers.map(h => {
      const v = record[h];
      return v === undefined || v === null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
    });
    await this._appendRows(`${this._tab(tabName)}!A1`, [row]);
    this._invalidateCache(tabName);
    return { ...record };
  }

  // Cập nhật ĐÚNG 1 dòng bằng 1 request (A{row}:{col}{row})
  // — không clear + ghi lại toàn bộ bảng (tiết kiệm quota ghi).
  async update(tabName, idField, idValue, patch) {
    const headers = await this._getHeaders(tabName, null);
    const rows = await this._readTable(tabName);
    const idx = rows.findIndex(r => String(r[idField] || '') === String(idValue));
    if (idx === -1) return null;
    const merged = { ...rows[idx], ...patch };
    const rowN = idx + 2; // dòng 1 là header, dữ liệu bắt đầu từ dòng 2
    const endCol = colLetter(headers.length);
    const values = [headers.map(h => (merged[h] == null ? '' : merged[h]))];
    await this._updateRange(`${this._tab(tabName)}!A${rowN}:${endCol}${rowN}`, values);
    this._invalidateCache(tabName);
    return merged;
  }

  // Xoá bằng deleteRows (1 request) thay vì clear + ghi lại cả bảng.
  async remove(tabName, idField, idValue) {
    const rows = await this._readTable(tabName);
    const idx = rows.findIndex(r => String(r[idField] || '') === String(idValue));
    if (idx === -1) return true;
    const sheetId = await this._sheetId(tabName);
    await this._api().spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: idx + 1, endIndex: idx + 2 } } }],
      },
    });
    this._invalidateCache(tabName);
    return true;
  }

  // Lấy sheetId (0-based) của tab — dùng cho batchUpdate (xoá dòng).
  async _sheetId(tabName) {
    if (this._sheetIdCache && this._sheetIdCache[tabName] != null) return this._sheetIdCache[tabName];
    const meta = await this._api().spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
      fields: 'sheets.properties(sheetId,title)',
    });
    const map = {};
    (meta.data.sheets || []).forEach(s => { map[s.properties.title] = s.properties.sheetId; });
    this._sheetIdCache = map;
    return map[tabName];
  }
}

// =============================================================================
// InMemoryStore — dùng khi chưa có Google credentials (dev/test/local)
// =============================================================================
class InMemoryStore {
  constructor() {
    this.tables = {};
    this._headers = {};
  }

  async ensureTable(tabName, schemaHeaders) {
    if (!this.tables[tabName]) {
      this.tables[tabName] = [];
      this._headers[tabName] = schemaHeaders || [];
    }
    return this;
  }

  async list(tabName) {
    return (this.tables[tabName] || []).slice();
  }

  async get(tabName, idField, idValue) {
    const rows = this.tables[tabName] || [];
    const found = rows.find(r => String(r[idField] || '') === String(idValue));
    return found ? { ...found } : null;
  }

  async query(tabName, predicate) {
    return (this.tables[tabName] || []).filter(predicate).map(r => ({ ...r }));
  }

  async insert(tabName, record) {
    if (!this.tables[tabName]) await this.ensureTable(tabName, Object.keys(record));
    const headers = this._headers[tabName];
    const clean = {};
    headers.forEach(h => { clean[h] = record[h] === undefined || record[h] === null ? '' : record[h]; });
    this.tables[tabName].push(clean);
    return { ...clean };
  }

  async update(tabName, idField, idValue, patch) {
    const rows = this.tables[tabName] || [];
    const idx = rows.findIndex(r => String(r[idField] || '') === String(idValue));
    if (idx === -1) return null;
    rows[idx] = { ...rows[idx], ...patch };
    return { ...rows[idx] };
  }

  async remove(tabName, idField, idValue) {
    const rows = this.tables[tabName] || [];
    this.tables[tabName] = rows.filter(r => String(r[idField] || '') !== String(idValue));
    return true;
  }

  // Tương tự SheetsStore: ghi lại toàn bộ bảng (dùng khi clean/dedupe)
  async _rebuildTable(tabName, rows) {
    await this.ensureTable(tabName, (rows && rows[0] && Object.keys(rows[0])) || []);
    const list = rows || [];
    this.tables[tabName] = list.map(r => ({ ...r }));
    return list;
  }
}

// =============================================================================
// Global registry — toàn bộ engines dùng chung một store instance
// =============================================================================
let activeStore = null;

function initStore(options = {}) {
  const serviceAccountKey = options.serviceAccountKey
    || process.env.GOOGLE_SERVICE_ACCOUNT
    || process.env.FIREBASE_SERVICE_ACCOUNT;
  const spreadsheetId = options.spreadsheetId
    || process.env.YNDA_SPREADSHEET_ID
    || process.env.SPREADSHEET_YNDA
    || '';

  if (options.mode === 'memory' || !serviceAccountKey || !spreadsheetId) {
    activeStore = new InMemoryStore();
    return activeStore;
  }
  activeStore = new SheetsStore({ spreadsheetId, serviceAccountKey });
  return activeStore;
}

function store() {
  if (!activeStore) initStore();
  return activeStore;
}

function resetStore() {
  activeStore = null;
}

function uid(prefix = 'YNDA') {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

module.exports = {
  SheetsStore,
  InMemoryStore,
  initStore,
  store,
  resetStore,
  uid,
  parseServiceAccount,
};
