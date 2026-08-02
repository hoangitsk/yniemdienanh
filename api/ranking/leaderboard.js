const { getRows } = require('../../lib/googleSheets');

const RANKING_SHEET_ID = '1rFuGWw4IZxmROnP7W4k1ntEykstZZu0JP3mKexihR6E';

function norm(s) {
  return String(s || '').toLowerCase().trim();
}

function isCore(role) {
  const r = norm(role);
  return r.includes('core') || r.includes('btc') || r.includes('ban tổ chức') || r.includes('trưởng') || r.includes('phó') || r.includes('vice') || r.includes('head') || r.includes('lead');
}

async function readMembers(sid) {
  const raw = await getRows(sid, "'Thành viên'!A1:G1000").catch(() => []);
  const members = [];
  for (const row of raw) {
    if (!row || row.length < 2) continue;
    const name = String(row[1] || '').trim();
    if (!name) continue;
    if (norm(name) === 'họ và tên' || norm(name) === 'tên' || norm(name) === 'stt') continue;
    members.push({
      name,
      dept: String(row[2] || '').trim(),
      role: String(row[3] || '').trim(),
      email: String(row[4] || '').trim(),
      phone: String(row[5] || '').trim(),
      note: String(row[6] || '').trim()
    });
  }
  return members;
}

async function readPoints(sid) {
  const raw = await getRows(sid, "'Điểm'!A1:E1000").catch(() => []);
  const points = [];
  for (const row of raw) {
    if (!row || row.length < 3) continue;
    const name = String(row[1] || '').trim();
    if (!name) continue;
    if (norm(name) === 'họ và tên' || norm(name) === 'tên' || norm(name) === 'stt') continue;
    const val = String(row[2] || '0').replace(/[^\d.-]/g, '');
    const pts = parseFloat(val);
    if (isNaN(pts) || pts <= 0) continue;
    points.push({
      name,
      points: pts,
      reason: String(row[3] || '').trim(),
      date: String(row[4] || '').trim()
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
        email: m.email,
        phone: m.phone,
        note: m.note,
        totalPoints: Math.round(pt.total * 10) / 10,
        pointEntries: pt.count,
        reasons: pt.reasons,
        group: isCore(m.role) ? 'core' : 'mem'
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

    const core = rank(allEntries.filter(e => e.group === 'core'));
    const mem = rank(allEntries.filter(e => e.group === 'mem'));

    res.json({
      success: true,
      updatedAt: new Date().toISOString(),
      spreadsheetId: sid,
      summary: { totalMembers: allEntries.length, core: core.length, mem: mem.length },
      core,
      mem
    });
  } catch (err) {
    console.error('[Ranking] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
