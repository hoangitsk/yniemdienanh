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
  async _getHeaders(tabName, schemaHeaders) {
    const cacheKey = tabName;
    if (this._headerCache[cacheKey]) return this._headerCache[cacheKey];
    const rows = await this._readRange(`${this._tab(tabName)}!A1:ZZ1`).catch(() => []);
    let headers = (rows && rows[0]) || [];
    if (!headers.length && schemaHeaders && schemaHeaders.length) {
      headers = schemaHeaders.slice();
      await this._appendRows(`${this._tab(tabName)}!A1`, [headers]);
    }
    this._headerCache[cacheKey] = headers;
    return headers;
  }

  // Lấy toàn bộ rows của tab dưới dạng mảng objects (theo header).
  async _readTable(tabName) {
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
    return rows;
  }

  // Ghi lại toàn bộ bảng (dùng khi update 1 dòng đơn giản).
  async _writeTable(tabName, rows) {
    const headers = await this._getHeaders(tabName, null);
    await this._clearRange(`${this._tab(tabName)}!A2:ZZ50000`);
    if (rows.length) {
      const values = rows.map(r => headers.map(h => (r[h] == null ? '' : r[h])));
      await this._appendRows(`${this._tab(tabName)}!A2`, values);
    }
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
    return { ...record };
  }

  async update(tabName, idField, idValue, patch) {
    const rows = await this._readTable(tabName);
    const headers = rows.length ? rows[0] && Object.keys(rows[0]) : Object.keys(patch);
    const idx = rows.findIndex(r => String(r[idField] || '') === String(idValue));
    if (idx === -1) return null;
    const merged = { ...rows[idx], ...patch };
    const values = rows.map((r, i) => {
      if (i !== idx) return headers.map(h => (r[h] == null ? '' : r[h]));
      return headers.map(h => (merged[h] == null ? '' : merged[h]));
    });
    await this._clearRange(`${this._tab(tabName)}!A2:ZZ50000`);
    if (values.length) await this._appendRows(`${this._tab(tabName)}!A2`, values);
    return merged;
  }

  async remove(tabName, idField, idValue) {
    const rows = await this._readTable(tabName);
    const next = rows.filter(r => String(r[idField] || '') !== String(idValue));
    await this._writeTable(tabName, next);
    return true;
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
