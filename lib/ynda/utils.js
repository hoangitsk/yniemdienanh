'use strict';

// =============================================================================
// YNDA UTILS — ngày giờ, mã số, định dạng
// =============================================================================

const pad = n => String(n).padStart(2, '0');

// Trả ISO string theo giờ Asia/Ho_Chi_Minh
function nowIso() {
  return new Date().toISOString();
}

// "13/08" style — dd/mm
function fmtDDMM(iso) {
  const d = parseDate(iso);
  if (!d) return '';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

function fmtDDMMYYYY(iso) {
  const d = parseDate(iso);
  if (!d) return '';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function fmtFull(iso) {
  const d = parseDate(iso);
  if (!d) return '';
  return `${fmtDDMMYYYY(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Chuyển mọi dạng ngày (ISO, Date, "15/08/2026 20:00", timestamp) -> Date
function parseDate(input) {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  if (typeof input === 'number' || /^\d{10,13}$/.test(String(input))) {
    const d = new Date(Number(input));
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(input).trim();
  // "dd/mm/yyyy hh:mm" or "dd/mm/yyyy"
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]) || 0, Number(m[5]) || 0, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// Số ngày trôi qua giữa 2 mốc (dương khi target > start)
function progressPct(startIso, endIso, atIso) {
  const start = parseDate(startIso);
  const end = parseDate(endIso);
  const at = parseDate(atIso || nowIso());
  if (!start || !end) return 0;
  const total = end.getTime() - start.getTime();
  if (total <= 0) return at.getTime() >= end.getTime() ? 1 : 0;
  const elapsed = at.getTime() - start.getTime();
  return Math.max(0, Math.min(1, elapsed / total));
}

function isOverdue(deadlineIso, atIso) {
  const deadline = parseDate(deadlineIso);
  const at = parseDate(atIso || nowIso());
  if (!deadline) return false;
  return at.getTime() > deadline.getTime();
}

// Sinh mã nhiệm vụ theo ban: TRU-026, MEDIA-014 ...
function taskCode(departmentPrefix, counter) {
  const num = String(counter).padStart(3, '0');
  return `${departmentPrefix}-${num}`;
}

function toNumber(v) {
  if (v == null || v === '') return 0;
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

function round2(v) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

// JSON-safe cho các trường lưu vào Sheets
function safeJson(v, fallback) {
  if (v == null) return fallback == null ? '' : JSON.stringify(fallback);
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch (e) {
    return '';
  }
}

function parseJson(v, fallback) {
  if (v == null || v === '') return fallback;
  if (typeof v === 'object') return v;
  try {
    const p = JSON.parse(v);
    if (p && typeof p === 'object') return p;
  } catch (e) {}
  // trường hợp string JSON bọc
  try {
    const p = JSON.parse(String(v).replace(/^"|"$/g, '').replace(/\\"/g, '"'));
    if (p && typeof p === 'object') return p;
  } catch (e2) {}
  return fallback;
}

function escapeSheet(bookmark) {
  return String(bookmark || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_\- ]/g, '')
    .replace(/\s+/g, '_')
    .toUpperCase();
}

module.exports = {
  nowIso, fmtDDMM, fmtDDMMYYYY, fmtFull, parseDate,
  progressPct, isOverdue, taskCode, toNumber, round2,
  safeJson, parseJson, escapeSheet,
};