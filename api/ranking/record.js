const { getRows, appendRows } = require('../../lib/googleSheets');
const { ensureSheet } = require('../../lib/googleSheetsFormatter');

const RANKING_SHEET_ID = '1SgbkoiSXP_zNYWN_AC6WKXTGQPbRAHfs2gwv_NOnsJM';

const POINT_HEADER = ['STT', 'Họ và tên', 'Số điểm', 'Lý do', 'Ngày'];
const EVAL_HEADER = [
  'STT', 'Họ và tên', 'Vai trò', 'Ban', 'Tuần', 'Loại',
  'TC1', 'TC2', 'TC3', 'TC4', 'Tổng', 'Có vấn đề', 'Người đánh giá', 'Ngày', 'Ghi chú'
];
const MONTH_HEADER = ['Tháng', 'Hạng', 'Họ và tên', 'Ban', 'Số điểm', 'Lý do'];

function parseId(val) {
  if (val && typeof val === 'string' && val.includes('/spreadsheets/d/')) {
    const match = val.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match) return match[1];
  }
  return val ? String(val).trim() : '';
}

function safeTitle(title) {
  return `'${String(title).replace(/'/g, "''")}'`;
}

async function ensureTab(sid, title, headers) {
  await ensureSheet(sid, title, headers.length);
  const range = `${safeTitle(title)}!A1:A1`;
  const existing = await getRows(sid, range).catch(() => []);
  const hasHeader = existing.length > 0 && existing[0][0] && String(existing[0][0]).trim() !== '';
  if (!hasHeader) {
    await appendRows(sid, `${safeTitle(title)}!A1`, [headers]);
  }
}

async function nextStt(sid, title) {
  const range = `${safeTitle(title)}!A1:A5000`;
  const rows = await getRows(sid, range).catch(() => []);
  let count = 0;
  for (const r of rows) {
    const v = String(r && r[0] || '').trim();
    if (v && /^\d+$/.test(v)) count = Math.max(count, parseInt(v, 10));
  }
  return count + 1;
}

function today() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function num(v) {
  const n = parseFloat(String(v == null ? '' : v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

function norm(s) {
  return String(s || '').toLowerCase().trim();
}

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

async function archiveMonth(sid, month) {
  await ensureTab(sid, 'Điểm', POINT_HEADER);

  const raw = await getRows(sid, `${safeTitle('Điểm')}!A1:E3000`).catch(() => []);
  const points = [];
  if (raw.length) {
    const header = raw[0];
    const iName = header.findIndex(h => norm(h) === 'họ và tên' || norm(h) === 'tên');
    const iPts = header.findIndex(h => norm(h) === 'số điểm' || norm(h) === 'điểm');
    const iReason = header.findIndex(h => norm(h) === 'lý do');
    const iDate = header.findIndex(h => norm(h) === 'ngày');
    for (let r = 1; r < raw.length; r++) {
      const row = raw[r];
      const name = String(row && row[iName] || '').trim();
      if (!name) continue;
      const pts = num(row && row[iPts]);
      if (pts <= 0) continue;
      const mk = parseMonthKey(row && row[iDate]);
      if (mk !== month) continue;
      points.push({
        name,
        points: pts,
        reason: String(row && row[iReason] || '').trim(),
        date: String(row && row[iDate] || '').trim()
      });
    }
  }

  const totals = {};
  for (const p of points) {
    const key = norm(p.name);
    if (!totals[key]) totals[key] = { name: p.name, total: 0, count: 0, reasons: [] };
    totals[key].total += p.points;
    totals[key].count += 1;
    if (p.reason && totals[key].reasons.length < 3) totals[key].reasons.push(p.reason);
  }

  const ranked = Object.values(totals)
    .filter(t => t.total > 0)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'vi'))
    .map((t, i) => ({ ...t, rank: i + 1 }));

  await ensureTab(sid, 'Tổng kết tháng', MONTH_HEADER);

  const rows = ranked.map(t => [
    month,
    t.rank,
    t.name,
    '',
    Math.round(t.total * 10) / 10,
    t.reasons.join('; ')
  ]);

  if (rows.length) {
    await appendRows(sid, `${safeTitle('Tổng kết tháng')}!A1`, rows);
  }

  return { month, archived: rows.length, rows };
}

module.exports = async (req, res) => {
  const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://yniemdienanh.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sid = parseId(req.body && req.body.sid) || process.env.SPREADSHEET_RANKING || RANKING_SHEET_ID;
    const action = req.body && req.body.action;
    const evaluator = (req.authUser && (req.authUser.email || req.authUser.uid)) || 'BTC';

    if (action === 'add-point') {
      const name = String((req.body && req.body.name) || '').trim();
      const points = num(req.body && req.body.points);
      const reason = String((req.body && req.body.reason) || '').trim();
      const date = String((req.body && req.body.date) || today()).trim();
      if (!name) return res.status(400).json({ success: false, error: 'Thiếu họ và tên.' });
      if (points <= 0) return res.status(400).json({ success: false, error: 'Số điểm phải là số dương.' });

      await ensureTab(sid, 'Điểm', POINT_HEADER);
      const stt = await nextStt(sid, 'Điểm');
      await appendRows(sid, `${safeTitle('Điểm')}!A1`, [[stt, name, points, reason, date]]);
      return res.json({ success: true, action, recorded: [{ stt, name, points, reason, date }] });
    }

    if (action === 'archive-month') {
      const month = String((req.body && req.body.month) || '').trim();
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ success: false, error: 'Thiếu hoặc sai định dạng tháng (YYYY-MM).' });
      }
      const result = await archiveMonth(sid, month);
      return res.json({ success: true, action, result });
    }

    if (action === 'evaluate') {
      const records = Array.isArray(req.body && req.body.records) ? req.body.records : [];
      if (req.body && req.body.record) records.push(req.body.record);
      if (!records.length) return res.status(400).json({ success: false, error: 'Chưa có dữ liệu đánh giá.' });

      await ensureTab(sid, 'Đánh giá', EVAL_HEADER);
      let stt = await nextStt(sid, 'Đánh giá');

      const rows = [];
      for (const r of records) {
        const name = String(r.name || '').trim();
        if (!name) continue;
        const week = String(r.week || '').trim() || '—';
        const type = String(r.type || 'CORE').trim().toUpperCase();
        const tc = Array.isArray(r.criteria) ? r.criteria.map(num) : [0, 0, 0, 0];
        let total = num(r.total);
        if (!total) total = Math.round((tc[0] + tc[1] + tc[2] + tc[3]) * 10) / 10;
        total = Math.max(0, Math.min(100, Math.round(total * 10) / 10));
        const issue = r.hasIssue ? 'Có' : 'Không';
        const note = String(r.note || '').trim();
        const role = String(r.role || '').trim();
        const dept = String(r.dept || '').trim();
        rows.push([
          stt++, name, role, dept, week, type,
          tc[0], tc[1], tc[2], tc[3], total, issue, evaluator, today(), note
        ]);
      }

      if (!rows.length) return res.status(400).json({ success: false, error: 'Không có dòng đánh giá hợp lệ.' });
      await appendRows(sid, `${safeTitle('Đánh giá')}!A1`, rows);
      return res.json({ success: true, action, recorded: rows.length, rows });
    }

    return res.status(400).json({ success: false, error: 'Action không hợp lệ.' });
  } catch (err) {
    console.error('[RankingRecord] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};