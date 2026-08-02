const { getRows } = require('../../lib/googleSheets');

const RANKING_SHEET_ID = '1rFuGWw4IZxmROnP7W4k1ntEykstZZu0JP3mKexihR6E';

function norm(s) {
  return String(s || '').toLowerCase().trim();
}

function isCore(role) {
  const r = norm(role);
  return r.includes('core') || r.includes('btc') || r.includes('ban tổ chức') || r.includes('trưởng') || r.includes('phó') || r.includes('vice') || r.includes('head') || r.includes('lead');
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

async function readMembers(sid) {
  const raw = await getRows(sid, "'Thành viên'!A1:H1000").catch(() => []);
  if (!raw.length) return [];
  const header = raw[0];
  const iName = colIndex(header, 'họ và tên', 'tên');
  if (iName < 0) return [];
  const iDept = colIndex(header, 'ban');
  const iRole = colIndex(header, 'vai trò');
  const iTitle = colIndex(header, 'chức danh', 'chuc danh', 'vị trí');
  const iEmail = colIndex(header, 'email');
  const iPhone = colIndex(header, 'sđt', 'sdt', 'số điện thoại', 'điện thoại');
  const iNote = colIndex(header, 'ghi chú');

  const members = [];
  for (let r = 1; r < raw.length; r++) {
    const row = raw[r];
    const name = cell(row, iName);
    if (!name || norm(name) === 'stt' || norm(name) === 'tên') continue;
    members.push({
      name,
      dept: cell(row, iDept),
      role: cell(row, iRole),
      title: cell(row, iTitle),
      email: cell(row, iEmail),
      phone: cell(row, iPhone),
      note: cell(row, iNote)
    });
  }
  return members;
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

    const pointMap = {};
    for (const p of points) {
      const key = p.name.toLowerCase();
      pointMap[key] = pointMap[key] || { total: 0, count: 0, reasons: [] };
      pointMap[key].total += p.points;
      pointMap[key].count += 1;
      if (p.reason && pointMap[key].reasons.length < 3) pointMap[key].reasons.push(p.reason);
    }

    const knownNames = new Set(members.map(m => m.name.toLowerCase()));

    // Gộp người có điểm nhưng chưa có trong tab Thành viên
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
        group: isCore(m.role) || isCore(m.title) ? 'core' : 'mem'
      });
    }
    for (const p of points) {
      const key = p.name.toLowerCase();
      if (knownNames.has(key) || seen.has(key)) continue;
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

    res.json({
      success: true,
      updatedAt: new Date().toISOString(),
      spreadsheetId: sid,
      summary: { totalMembers: allEntries.length, core: core.length, mem: mem.length },
      all,
      core,
      mem
    });
  } catch (err) {
    console.error('[Ranking] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
