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

async function syncDepartmentTab(sid, deptTitle, allApps) {
  const { getRows, appendRows } = require('../../lib/googleSheetsFormatter');
  try {
    const norm = s => String(s || '').toLowerCase().replace(/^ban\s+/, '').trim();
    const targetNorm = norm(deptTitle);
    const deptApps = allApps.filter(a => norm(a.dept).includes(targetNorm) || targetNorm.includes(norm(a.dept)));

    if (!deptApps || deptApps.length === 0) return;

    const rawRows = await getRows(sid, `${deptTitle}!A1:L500`).catch(() => []);
    
    let headerRowIdx = -1;
    for (let i = 0; i < rawRows.length; i++) {
      const line = (rawRows[i] || []).map(c => String(c || '').toLowerCase()).join(' ');
      if (line.includes('mã hồ sơ') || line.includes('họ và tên') || line.includes('email')) {
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx === -1) return;

    const dataRows = rawRows.slice(headerRowIdx + 1);
    const existingKeys = new Set();

    dataRows.forEach(row => {
      const idVal = String(row[1] || '').trim();
      const emailVal = String(row[5] || '').trim().toLowerCase();
      if (idVal && idVal !== '0') existingKeys.add(idVal);
      if (emailVal) existingKeys.add(emailVal);
    });

    let currentStt = dataRows.length;
    const newRowsToAppend = [];

    const sortedDeptApps = [...deptApps].sort((a, b) => {
      const dateA = a.date || formatDate(a.createdAt) || '';
      const dateB = b.date || formatDate(b.createdAt) || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return String(a.id || '').localeCompare(String(b.id || ''), undefined, { numeric: true });
    });

    for (const app of sortedDeptApps) {
      const appIdStr = String(app.id || '').trim();
      const emailStr = String(app.email || '').trim().toLowerCase();

      if ((appIdStr && existingKeys.has(appIdStr)) || (emailStr && existingKeys.has(emailStr))) {
        continue;
      }

      currentStt += 1;
      const posText = app.position === 'vice_lead' ? 'Vice' : (app.position === 'core' ? 'Core' : 'Thành viên');
      const dateStr = app.date || formatDate(app.createdAt) || new Date().toISOString().slice(0, 10);

      newRowsToAppend.push([
        currentStt,
        app.id || '0',
        app.name || '',
        app.name || '',
        posText,
        app.email || '',
        app.phone || '',
        dateStr,
        'Qua vòng đơn',
        'Chờ xếp lịch',
        '',
        ''
      ]);
    }

    if (newRowsToAppend.length > 0) {
      const nextRowNumber = headerRowIdx + 2 + dataRows.length;
      const appendRange = `${deptTitle}!A${nextRowNumber}`;
      await appendRows(sid, appendRange, newRowsToAppend);
      console.log(`[HRSync] Appended ${newRowsToAppend.length} new applications to tab ${deptTitle}`);
    }
  } catch (err) {
    console.warn(`[HRSync] Department tab '${deptTitle}' sync skipped:`, err.message);
  }
}

async function syncApplications(db, sid) {
  const appsSnap = await db.collection('applications').get();
  const usersSnap = await db.collection('users').get();
  const usersMap = new Map();
  usersSnap.forEach(d => usersMap.set(d.id, d.data()));

  const allApps = [];
  appsSnap.forEach(d => {
    const a = d.data();
    allApps.push({ ...a, docId: d.id });
  });

  const rows = allApps.map(a => {
    const user = usersMap.get(a.approvedUserId || '');
    return [
      a.name || '',
      a.email || '',
      a.dept || '',
      a.position || '',
      a.type || '',
      a.recruitmentStage || '',
      a.status || 'pending',
      formatDate(a.createdAt || a.date),
      a.approvedUserId || '',
      user?.interviewStatus || '',
      a.id || a.docId,
    ];
  });

  rows.sort((a, b) => (a[7] || '').localeCompare(b[7] || ''));

  await writeTable(sid, 'Ứng viên', [
    'Họ tên', 'Email', 'Ban', 'Vị trí', 'Loại', 'Giai đoạn', 'Trạng thái',
    'Ngày đăng ký', 'UID', 'Tình trạng PV', 'Mã ứng viên',
  ], rows, 6).catch(() => {});

  // Sync to department tabs matching YNDA_Danh_sach_phong_van
  const depts = ['Ban Nội dung', 'Ban Nhân sự', 'Ban Truyền thông', 'Ban Media', 'Ban Duyệt bài'];
  for (const deptName of depts) {
    await syncDepartmentTab(sid, deptName, allApps);
  }
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
    // Lọc chỉ lấy thành viên Ban Tổ Chức / Core / Admin
    const isCore = u.role === 'admin' || u.role === 'organizer' || u.position === 'core' || u.position === 'vice_lead' || u.isCore === true;
    if (!isCore) return;

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
        role: 'organizer',
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
    let rawDefaultSid = process.env.SPREADSHEET_HR_DASHBOARD || process.env.SPREADSHEET_ID;
    let sidCore = req.body?.spreadsheetCoreId || req.query?.spreadsheetCoreId || req.body?.spreadsheetId || req.query?.spreadsheetId || process.env.SPREADSHEET_CORE_DATABASE || rawDefaultSid;
    let sidApps = req.body?.spreadsheetAppId || req.query?.spreadsheetAppId || req.body?.spreadsheetId || req.query?.spreadsheetId || process.env.SPREADSHEET_APPLICATIONS || rawDefaultSid;

    const parseId = (val) => {
      if (val && typeof val === 'string' && val.includes('/spreadsheets/d/')) {
        const match = val.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (match) return match[1];
      }
      return val ? String(val).trim() : '';
    };

    sidCore = parseId(sidCore);
    sidApps = parseId(sidApps);

    if (!sidCore && !sidApps) return res.status(503).json({ error: 'Chưa nhập hoặc chưa cấu hình mã Google Sheet' });
    if (!process.env.GOOGLE_SERVICE_ACCOUNT) return res.status(503).json({ error: 'GOOGLE_SERVICE_ACCOUNT chưa được cấu hình' });

    const db = ensureFirebase();

    const mode = req.query?.mode || req.body?.mode || 'two_way';
    let pullResult = null;
    if ((mode === 'pull' || mode === 'two_way') && sidCore) {
      pullResult = await pullFromSheets(db, sidCore);
    }

    const tasks = [];
    const names = [];

    if (sidCore) {
      tasks.push(syncCoreTeam(db, sidCore));
      names.push('DATABASE CORE');
    }
    if (sidApps) {
      tasks.push(syncApplications(db, sidApps));
      names.push('Ứng viên');
      tasks.push(syncInterviews(db, sidApps));
      names.push('Lịch PV');
      tasks.push(syncStaffPoints(db, sidApps));
      names.push('Staff Points');
      tasks.push(syncAuditLogs(db, sidApps));
      names.push('Nhật ký');
    }

    const results = await Promise.allSettled(tasks);

    const report = results.map((r, i) => `${names[i]}: ${r.status === 'fulfilled' ? 'OK' : 'LỖI: ' + r.reason?.message}`);

    console.log('[HRSync]', report.join(' | '));
    res.json({ success: true, mode, pullResult, report });
  } catch (err) {
    console.error('[HRSync] Error:', err);
    res.status(500).json({ error: err.message });
  }
};
