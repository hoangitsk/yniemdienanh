const { getRows } = require('../../lib/googleSheets');
const authHelper = require('../../lib/ynda/auth');

const RANKING_SHEET_ID = process.env.SPREADSHEET_RANKING || '1SgbkoiSXP_zNYWN_AC6WKXTGQPbRAHfs2gwv_NOnsJM';

function norm(s) {
  return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function colIndex(headerRow, ...aliases) {
  if (!Array.isArray(headerRow)) return -1;
  const normalized = headerRow.map(h => norm(h));
  for (let i = 0; i < normalized.length; i++) {
    if (aliases.some(a => normalized[i] === a)) return i;
  }
  return -1;
}

function cell(row, idx) {
  return row && idx >= 0 && idx < row.length ? String(row[idx] || '').trim() : '';
}

function findHeaderRow(raw, markers) {
  const limit = Math.min(raw.length, 8);
  for (let r = 0; r < limit; r++) {
    const row = raw[r] || [];
    if (markers.some(m => row.some(c => norm(c) === m))) return r;
    // header could be 'họ và tên' with spacing variants already normalized; also match 'họ và tên'
  }
  return -1;
}

// Đọc danh sách thành viên từ ranking sheet (DATABASE CORE + DATABASE THÀNH VIÊN)
async function readMembers(sid) {
  let sheetsApi = null;
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountKey && serviceAccountKey !== '[SENSITIVE]') {
    try {
      const { google } = require('googleapis');
      const { parseServiceAccount } = require('../../lib/googleSheets');
      const credentials = parseServiceAccount(serviceAccountKey);
      if (credentials && credentials.client_email && credentials.private_key) {
        const authClient = new google.auth.JWT(
          credentials.client_email,
          null,
          credentials.private_key,
          ['https://www.googleapis.com/auth/spreadsheets.readonly']
        );
        sheetsApi = google.sheets({ version: 'v4', auth: authClient });
      }
    } catch (e) {}
  }

  const rawMembers = await authHelper.readRankingMembers(sheetsApi, sid);
  return (rawMembers || []).map(m => {
    const roleUpper = String(m.role || '').toUpperCase();
    const isAdvisor = roleUpper === 'ADVISOR' || /co van|advisor/i.test(m.rawRole || '') || /co van/i.test(m.ban || '');
    const isExec = roleUpper === 'FOUNDER' || roleUpper === 'PRESIDENT' || roleUpper === 'CO_FOUNDER';
    const isCore = isExec || isAdvisor || roleUpper === 'CORE' || roleUpper === 'VICE';
    const deptCanonical = authHelper.canonicalDept ? authHelper.canonicalDept(m.ban, m.rawRole, m.role, m.name) : (m.ban || m.department || (isExec ? 'Ban Điều Hành' : ''));
    return {
      name: m.name,
      dept: deptCanonical,
      role: isAdvisor ? 'Cố vấn chuyên môn' : (isExec ? 'Lãnh đạo' : (isCore ? 'Core' : 'Thành viên')),
      title: m.rawRole || (isAdvisor ? 'Cố vấn chuyên môn' : (isExec ? 'Lãnh đạo' : (isCore ? 'Core Member' : 'Thành viên'))),
      email: m.email || '',
      phone: m.phone || '',
      facebook: m.facebook || '',
      note: m.notes || '',
      group: isCore ? 'core' : 'mem'
    };
  });
}

async function readPoints(sid) {
  let raw = [];
  try {
    raw = await getRows(sid, "'Điểm'!A1:E1000").catch(() => []);
  } catch (e) {}

  if (!raw.length) {
    try {
      const gvizUrl = `https://docs.google.com/spreadsheets/d/${sid}/gviz/tq?tqx=out:csv&sheet=%C4%90i%E1%BB%83m`;
      const res = await fetch(gvizUrl);
      if (res.ok) {
        const text = await res.text();
        const { parseCsvText } = require('../../lib/ynda/auth');
        raw = parseCsvText(text);
      }
    } catch (e) {}
  }

  if (!raw.length) return [];
  const header = raw[0];
  const iName = colIndex(header, 'họ và tên', 'tên');
  const iPts = colIndex(header, 'số điểm', 'điểm');
  if (iName < 0 || iPts < 0) return [];
  const iReason = colIndex(header, 'lý do');
  const iDate = colIndex(header, 'ngày');

  const points = [];
  for (let r = 1; r < raw.length; r++) {
    const row = raw[r];
    const name = cell(row, iName);
    if (!name || norm(name) === 'stt' || norm(name) === 'tên') continue;
    const val = cell(row, iPts).replace(/[^\d.-]/g, '');
    const pts = parseFloat(val);
    if (isNaN(pts) || pts <= 0) continue;
    points.push({
      name,
      points: pts,
      reason: cell(row, iReason),
      date: cell(row, iDate)
    });
  }
  return points;
}

// Chuyển "02/08/2026", "2026-08-02", ISO... -> "2026-08"
function parseMonthKey(str) {
  const s = String(str || '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}`;
  m = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/\-.](\d{4})$/);
  if (m) return `${m[2]}-${String(m[1]).padStart(2, '0')}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return null;
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function buildRanking(members, pts) {
  const pointMap = {};
  for (const p of pts) {
    const key = p.name.toLowerCase();
    pointMap[key] = pointMap[key] || { total: 0, count: 0, reasons: [] };
    pointMap[key].total += p.points;
    pointMap[key].count += 1;
    if (p.reason && pointMap[key].reasons.length < 3) pointMap[key].reasons.push(p.reason);
  }

  const knownNames = new Set(members.map(m => m.name.toLowerCase()));

  const allEntries = [];
  const seen = new Set();
  for (const m of members) {
    const key = m.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const pt = pointMap[key] || { total: 0, count: 0, reasons: [] };
    allEntries.push({
      name: m.name,
      dept: m.dept,
      role: m.role,
      title: m.title,
      email: m.email,
      phone: m.phone,
      note: m.note,
      totalPoints: Math.round(pt.total * 10) / 10,
      pointEntries: pt.count,
      reasons: pt.reasons,
      group: m.group === 'core' ? 'core' : 'mem'
    });
  }
  for (const p of pts) {
    const key = p.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const pt = pointMap[key];
    allEntries.push({
      name: p.name,
      dept: '',
      role: '',
      title: '',
      email: '',
      phone: '',
      note: '',
      totalPoints: Math.round(pt.total * 10) / 10,
      pointEntries: pt.count,
      reasons: pt.reasons,
      group: 'mem'
    });
  }

  const rank = (arr) => arr
    .sort((a, b) => b.totalPoints - a.totalPoints || a.name.localeCompare(b.name, 'vi'))
    .map((item, i) => ({ ...item, rank: i + 1 }));

  const all = rank(allEntries);
  const core = rank(allEntries.filter(e => e.group === 'core'));
  const mem = rank(allEntries.filter(e => e.group === 'mem'));

  return {
    summary: { totalMembers: allEntries.length, core: core.length, mem: mem.length },
    all,
    core,
    mem
  };
}

const CACHE = {};
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

module.exports = async (req, res) => {
  const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://yniemdienanh.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const parseId = (val) => {
    if (val && typeof val === 'string' && val.includes('/spreadsheets/d/')) {
      const match = val.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match) return match[1];
    }
    return val ? String(val).trim() : '';
  };

  const sid = parseId(req.query.sid) || process.env.SPREADSHEET_RANKING || RANKING_SHEET_ID;

  try {
    let members, points;
    const cacheKey = `data_${sid}`;
    if (CACHE[cacheKey] && Date.now() - CACHE[cacheKey].time < CACHE_TTL) {
      members = CACHE[cacheKey].members;
      points = CACHE[cacheKey].points;
    } else {
      [members, points] = await Promise.all([readMembers(sid), readPoints(sid)]);
      CACHE[cacheKey] = { time: Date.now(), members, points };
    }

    const overall = buildRanking(members, points);

    // ===== BẢNG THEO THÁNG =====
    const monthToPoints = {};
    for (const p of points) {
      const mk = parseMonthKey(p.date);
      if (!mk) continue;
      if (!monthToPoints[mk]) monthToPoints[mk] = [];
      monthToPoints[mk].push(p);
    }
    const availableMonths = Object.keys(monthToPoints).sort().reverse();

    let targetMonth = String(req.query.month || '').trim();
    if (!/^\d{4}-\d{2}$/.test(targetMonth)) targetMonth = currentMonthKey();

    const monthlyPoints = monthToPoints[targetMonth] || [];
    const monthly = buildRanking(members, monthlyPoints);
    monthly.month = targetMonth;

    res.json({
      success: true,
      updatedAt: new Date().toISOString(),
      spreadsheetId: sid,
      overall: overall.summary,
      monthly,
      availableMonths,
      currentMonth: currentMonthKey(),
      summary: overall.summary,
      all: overall.all,
      core: overall.core,
      mem: overall.mem
    });
  } catch (err) {
    console.error('[Ranking] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};