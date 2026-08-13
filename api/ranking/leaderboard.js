const { getRows } = require('../../lib/googleSheets');

const RANKING_SHEET_ID = '1SgbkoiSXP_zNYWN_AC6WKXTGQPbRAHfs2gwv_NOnsJM';

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

// Đọc danh sách thành viên từ tab DATABASE CORE (group=core) và DATABASE THÀNH VIÊN (group=mem)
// Bỏ qua dòng tiêu đề (vd "DATABASE CORE TEAM – Ý NIỆM ĐIỆN ẢNH") bằng cách tìm dòng header.
async function readMembers(sid) {
  const tabs = [
    { title: 'DATABASE CORE', group: 'core' },
    { title: 'DATABASE THÀNH VIÊN', group: 'mem' }
  ];

  const all = [];
  const seen = new Set();

  for (const { title, group } of tabs) {
    const safeTitle = `'${title.replace(/'/g, "''")}'`;
    const raw = await getRows(sid, `${safeTitle}!A1:K1000`).catch(() => []);
    if (!raw.length) continue;

    const h = findHeaderRow(raw, ['họ và tên']);
    if (h < 0) continue;
    const header = raw[h];

    const iName = colIndex(header, 'họ và tên', 'tên');
    const iDept = colIndex(header, 'ban');
    const iTitle = colIndex(header, 'chức vụ', 'chuc vu', 'vai trò', 'chức danh');
    const iEmail = colIndex(header, 'email');
    const iPhone = colIndex(header, 'số điện thoại', 'sđt', 'sdt', 'điện thoại');
    const iNote = colIndex(header, 'ghi chú');

    if (iName < 0) continue;

    let lastDept = '';
    for (let r = h + 1; r < raw.length; r++) {
      const row = raw[r] || [];
      const deptRaw = cell(row, iDept);
      if (deptRaw) lastDept = deptRaw;

      const name = cell(row, iName);
      if (!name) continue;

      const email = cell(row, iEmail);
      const key = email ? email.toLowerCase() : name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      all.push({
        name,
        dept: lastDept,
        role: group === 'core' ? 'Core' : 'Thành viên',
        title: cell(row, iTitle),
        email,
        phone: cell(row, iPhone),
        note: cell(row, iNote),
        group
      });
    }
  }
  return all;
}

async function readPoints(sid) {
  const raw = await getRows(sid, "'Điểm'!A1:E1000").catch(() => []);
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

module.exports = async (req, res) => {
  const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://yniemdienanh.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Cache-Control', 'public, max-age=120');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const serviceKey = process.env.GOOGLE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceKey) return res.status(503).json({ error: 'Chưa cấu hình GOOGLE_SERVICE_ACCOUNT hoặc FIREBASE_SERVICE_ACCOUNT trên Vercel' });

  const parseId = (val) => {
    if (val && typeof val === 'string' && val.includes('/spreadsheets/d/')) {
      const match = val.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match) return match[1];
    }
    return val ? String(val).trim() : '';
  };

  const sid = parseId(req.query.sid) || process.env.SPREADSHEET_RANKING || RANKING_SHEET_ID;

  try {
    const [members, points] = await Promise.all([readMembers(sid), readPoints(sid)]);

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