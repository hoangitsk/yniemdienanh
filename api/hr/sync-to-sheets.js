const admin = require('firebase-admin');
const { writeTable } = require('../../lib/googleSheetsFormatter');

function ensureFirebase() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT chưa được cấu hình');
    let s = raw.trim();
    if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
    let acc = JSON.parse(s);
    if (typeof acc === 'string') acc = JSON.parse(acc);
    acc.private_key = acc.private_key.replace(/\\n/g, '\n');
    admin.initializeApp({ credential: admin.credential.cert(acc) });
  }
  return admin.firestore();
}

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function syncApplications(db, sid) {
  const appsSnap = await db.collection('applications').get();
  const usersSnap = await db.collection('users').get();
  const usersMap = new Map();
  usersSnap.forEach(d => usersMap.set(d.id, d.data()));

  const rows = [];
  appsSnap.forEach(d => {
    const a = d.data();
    const user = usersMap.get(a.approvedUserId || '');
    rows.push([
      a.name || '',
      a.email || '',
      a.dept || '',
      a.position || '',
      a.type || '',
      a.recruitmentStage || '',
      a.status || 'pending',
      formatDate(a.createdAt),
      a.approvedUserId || '',
      user?.interviewStatus || '',
      a.id || d.id,
    ]);
  });

  rows.sort((a, b) => (b[7] || '').localeCompare(a[7] || ''));

  await writeTable(sid, 'Ứng viên', [
    'Họ tên', 'Email', 'Ban', 'Vị trí', 'Loại', 'Giai đoạn', 'Trạng thái',
    'Ngày đăng ký', 'UID', 'Tình trạng PV', 'Mã ứng viên',
  ], rows, 6);
}

async function syncInterviews(db, sid) {
  const eventsSnap = await db.collection('scheduledEvents')
    .orderBy('startAt', 'desc')
    .get();

  const rows = [];
  eventsSnap.forEach(d => {
    const e = d.data();
    const start = e.startAt?.toDate ? e.startAt.toDate() : new Date(e.startAt || '');
    const completed = e.completedAt?.toDate ? e.completedAt.toDate() : (e.completedAt ? new Date(e.completedAt) : null);
    rows.push([
      formatDate(e.startAt),
      e.candidateName || '',
      e.candidateEmail || '',
      e.candidatePosition || '',
      e.candidateDepartment || '',
      e.assignedHrName || '',
      e.assignedHrEmail || '',
      e.status || '',
      e.type || '',
      start ? `${Math.floor(e.duration || 30)} phút` : '',
      completed ? formatDate(e.completedAt) : '',
      e.id || d.id,
    ]);
  });

  await writeTable(sid, 'Lịch PV', [
    'Thời gian', 'Ứng viên', 'Email UV', 'Vị trí', 'Ban',
    'HR phụ trách', 'Email HR', 'Trạng thái', 'Loại', 'Thời lượng',
    'Hoàn thành lúc', 'Mã sự kiện',
  ], rows, 7);
}

async function syncStaffPoints(db, sid) {
  const pointsSnap = await db.collection('staffPoints')
    .orderBy('createdAt', 'desc')
    .get();

  const rows = [];
  pointsSnap.forEach(d => {
    const p = d.data();
    rows.push([
      p.userName || '',
      p.dept || '',
      String(p.points || 0),
      p.reason || '',
      p.sourceType || '',
      p.sourceId || '',
      formatDate(p.createdAt),
    ]);
  });

  await writeTable(sid, 'Staff Points', [
    'Tên', 'Ban', 'Điểm', 'Lý do', 'Nguồn', 'Mã nguồn', 'Ngày tạo',
  ], rows, -1);
}

async function syncAuditLogs(db, sid) {
  const logsSnap = await db.collection('auditLogs')
    .orderBy('createdAt', 'desc')
    .limit(500)
    .get();

  const rows = [];
  logsSnap.forEach(d => {
    const l = d.data();
    rows.push([
      formatDate(l.createdAt),
      l.actorId || '',
      l.actorRole || '',
      l.action || '',
      l.entityType || '',
      l.entityId || '',
      l.reason || '',
      l.newValue ? JSON.stringify(l.newValue).slice(0, 200) : '',
    ]);
  });

  await writeTable(sid, 'Nhật ký', [
    'Thời gian', 'Người thực hiện', 'Vai trò', 'Hành động',
    'Loại đối tượng', 'Mã đối tượng', 'Lý do', 'Chi tiết',
  ], rows, -1);
}

async function syncCoreTeam(db, sid) {
  const usersSnap = await db.collection('users').get();
  const rows = [];
  usersSnap.forEach(d => {
    const u = d.data();
    rows.push([
      u.dept || u.projectGroup || 'BĐH',
      u.name || '',
      u.position || u.leadershipTitle || (u.role === 'admin' ? 'President' : (u.role === 'organizer' ? 'Core' : 'Thành viên')),
      u.gender || '',
      u.dob || '',
      u.hometown || u.address || '',
      u.school || '',
      u.email || '',
      u.phone || '',
      u.facebook || u.facebookUrl || '',
      u.notes || ''
    ]);
  });

  await writeTable(sid, 'DATABASE CORE', [
    'BAN', 'HỌ VÀ TÊN', 'CHỨC VỤ', 'GIỚI TÍNH', 'NGÀY SINH',
    'NƠI SINH SỐNG', 'TRƯỜNG - LỚP', 'EMAIL', 'SỐ ĐIỆN THOẠI',
    'LINK FACEBOOK', 'GHI CHÚ'
  ], rows, -1);
}

async function pullFromSheets(db, sid) {
  const { getRows } = require('../../lib/googleSheets');
  try {
    const coreRows = await getRows(sid, 'DATABASE CORE!A2:K500');
    let importedUsers = 0;
    for (const r of coreRows) {
      if (!r[7] || !r[7].includes('@')) continue;
      const email = r[7].trim().toLowerCase();
      const userSnap = await db.collection('users').where('email', '==', email).limit(1).get();
      const userData = {
        dept: r[0] || '',
        name: r[1] || '',
        position: r[2] || '',
        gender: r[3] || '',
        dob: r[4] || '',
        address: r[5] || '',
        school: r[6] || '',
        email: email,
        phone: r[8] || '',
        facebook: r[9] || '',
        notes: r[10] || '',
        updatedAt: new Date().toISOString()
      };
      if (userSnap.empty) {
        await db.collection('users').add({ ...userData, createdAt: new Date().toISOString() });
      } else {
        await db.collection('users').doc(userSnap.docs[0].id).update(userData);
      }
      importedUsers++;
    }
    return { importedUsers };
  } catch (err) {
    console.warn('[SheetPull] Error:', err.message);
    return { error: err.message };
  }
}

module.exports = async (req, res) => {
  try {
    let sid = req.body?.spreadsheetId || req.query?.spreadsheetId || process.env.SPREADSHEET_HR_DASHBOARD;
    if (sid && typeof sid === 'string' && sid.includes('/spreadsheets/d/')) {
      const match = sid.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match) sid = match[1];
    }
    if (!sid) return res.status(503).json({ error: 'Chưa nhập hoặc chưa cấu hình mã Google Sheet (SPREADSHEET_HR_DASHBOARD)' });
    if (!process.env.GOOGLE_SERVICE_ACCOUNT) return res.status(503).json({ error: 'GOOGLE_SERVICE_ACCOUNT chưa được cấu hình' });

    const db = ensureFirebase();

    const mode = req.query?.mode || req.body?.mode || 'two_way';
    let pullResult = null;
    if (mode === 'pull' || mode === 'two_way') {
      pullResult = await pullFromSheets(db, sid);
    }

    const results = await Promise.allSettled([
      syncCoreTeam(db, sid),
      syncApplications(db, sid),
      syncInterviews(db, sid),
      syncStaffPoints(db, sid),
      syncAuditLogs(db, sid),
    ]);

    const report = results.map((r, i) => {
      const names = ['DATABASE CORE', 'Ứng viên', 'Lịch PV', 'Staff Points', 'Nhật ký'];
      return `${names[i]}: ${r.status === 'fulfilled' ? 'OK' : 'LỖI: ' + r.reason?.message}`;
    });

    console.log('[HRSync]', report.join(' | '));
    res.json({ success: true, mode, pullResult, report });
  } catch (err) {
    console.error('[HRSync] Error:', err);
    res.status(500).json({ error: err.message });
  }
};
