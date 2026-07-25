const admin = require('firebase-admin');
const { writeTable } = require('../../lib/googleSheetsFormatter');

function ensureFirebase() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT chưa được cấu hình');
    const { parseServiceAccount } = require('../../lib/googleSheetsFormatter');
    const acc = parseServiceAccount(raw);
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

    const safeTitle = `'${deptTitle.replace(/'/g, "''")}'`;
    const rawRows = await getRows(sid, `${safeTitle}!A1:L500`).catch(() => []);
    
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
      const appendRange = `${safeTitle}!A${nextRowNumber}`;
      await appendRows(sid, appendRange, newRowsToAppend);
      console.log(`[HRSync] Appended ${newRowsToAppend.length} new applications to tab ${deptTitle}`);
    }
  } catch (err) {
    console.warn(`[HRSync] Department tab '${deptTitle}' sync skipped:`, err.message);
  }
}

async function syncTongHopTab(sid, allApps) {
  const { getRows, appendRows } = require('../../lib/googleSheetsFormatter');
  try {
    const safeTitle = `'Tổng hợp'`;
    const rawRows = await getRows(sid, `${safeTitle}!A1:L500`).catch(() => []);
    
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
      const emailVal = String(row[5] || row[6] || '').trim().toLowerCase();
      if (idVal && idVal !== '0') existingKeys.add(idVal);
      if (emailVal) existingKeys.add(emailVal);
    });

    let currentStt = dataRows.length;
    const newRowsToAppend = [];

    const sortedApps = [...allApps].sort((a, b) => {
      const dateA = a.date || formatDate(a.createdAt) || '';
      const dateB = b.date || formatDate(b.createdAt) || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return String(a.id || '').localeCompare(String(b.id || ''), undefined, { numeric: true });
    });

    for (const app of sortedApps) {
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
        app.dept || '',
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
      const appendRange = `${safeTitle}!A${nextRowNumber}`;
      await appendRows(sid, appendRange, newRowsToAppend);
      console.log(`[HRSync] Appended ${newRowsToAppend.length} new applications to tab 'Tổng hợp'`);
    }
  } catch (err) {
    console.warn(`[HRSync] Tab 'Tổng hợp' sync skipped:`, err.message);
  }
}

async function syncHoSoChiTietTab(sid, allApps, usersMap) {
  const { getRows, appendRows } = require('../../lib/googleSheetsFormatter');
  try {
    const safeTitle = `'Hồ sơ chi tiết'`;
    const rawRows = await getRows(sid, `${safeTitle}!A1:E500`).catch(() => []);
    
    let headerRowIdx = -1;
    for (let i = 0; i < rawRows.length; i++) {
      const line = (rawRows[i] || []).map(c => String(c || '').toLowerCase()).join(' ');
      if (line.includes('mã hồ sơ') || line.includes('họ và tên') || line.includes('email') || line.includes('ban')) {
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx === -1) return;

    const dataRows = rawRows.slice(headerRowIdx + 1);
    const existingKeys = new Set();

    dataRows.forEach(row => {
      const firstCol = String(row[0] || '').trim();
      const emailVal = String(row[3] || '').trim().toLowerCase();
      if (firstCol) existingKeys.add(firstCol);
      if (emailVal) existingKeys.add(emailVal);
    });

    let currentStt = dataRows.length;
    const newRowsToAppend = [];

    const sortedApps = [...allApps].sort((a, b) => {
      const dateA = a.date || formatDate(a.createdAt) || '';
      const dateB = b.date || formatDate(b.createdAt) || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return String(a.id || '').localeCompare(String(b.id || ''), undefined, { numeric: true });
    });

    for (const app of sortedApps) {
      const appIdStr = String(app.id || '').trim();
      const emailStr = String(app.email || '').trim().toLowerCase();
      const user = usersMap.get(app.approvedUserId || '') || usersMap.get(app.uid || '') || {};

      if ((appIdStr && existingKeys.has(appIdStr)) || (emailStr && existingKeys.has(emailStr))) {
        continue;
      }

      currentStt += 1;
      const combinedCode = `${currentStt} ${app.id || '0'}`;
      const detailEssay = app.intro || app.essay || app.answers || user.intro || user.interest || 'Chưa có thông tin bài luận';

      newRowsToAppend.push([
        combinedCode,
        app.dept || '',
        app.name || '',
        app.email || '',
        detailEssay
      ]);
    }

    if (newRowsToAppend.length > 0) {
      const nextRowNumber = headerRowIdx + 2 + dataRows.length;
      const appendRange = `${safeTitle}!A${nextRowNumber}`;
      await appendRows(sid, appendRange, newRowsToAppend);
      console.log(`[HRSync] Appended ${newRowsToAppend.length} new applications to tab 'Hồ sơ chi tiết'`);
    }
  } catch (err) {
    console.warn(`[HRSync] Tab 'Hồ sơ chi tiết' sync skipped:`, err.message);
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
  await syncTongHopTab(sid, allApps);
  await syncHoSoChiTietTab(sid, allApps, usersMap);
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
  const allUsers = [];
  usersSnap.forEach(d => {
    allUsers.push({ ...d.data(), id: d.id });
  });

  const depts = [
    'BĐH',
    'Ban Nội dung',
    'Ban Nhân sự',
    'Ban Truyền thông',
    'Ban Media',
    'Ban Duyệt bài'
  ];

  const norm = s => String(s || '').toLowerCase().replace(/^ban\s+/, '').replace(/^bđh\s*-?\s*/, '').trim();

  const bdhUsers = [];
  const memberUsers = [];

  allUsers.forEach(u => {
    const isBdh = u.role === 'admin' || u.role === 'organizer' || u.position === 'core' || u.position === 'vice_lead' || u.isCore === true;
    if (isBdh) bdhUsers.push(u);
    else memberUsers.push(u);
  });

  const bdhOrdered = [];
  depts.forEach(deptName => {
    const deptNorm = norm(deptName);
    const inDept = bdhUsers.filter(u => norm(u.dept || u.projectGroup) === deptNorm || (deptName === 'BĐH' && (!u.dept || u.role === 'admin')));

    const cores = inDept.filter(u => u.position === 'core' || u.position === 'head' || u.role === 'admin' || (!u.position && u.role === 'organizer'));
    const vices = [...inDept.filter(u => u.position === 'vice_lead' || u.position === 'vice')];
    const others = inDept.filter(u => !cores.includes(u) && !vices.includes(u));

    const deptRows = [];
    cores.forEach(c => {
      deptRows.push(c);
      if (vices.length > 0) {
        deptRows.push(vices.shift());
      }
    });
    vices.forEach(v => deptRows.push(v));
    others.forEach(o => deptRows.push(o));

    bdhOrdered.push(...deptRows);
  });

  bdhUsers.forEach(u => {
    if (!bdhOrdered.includes(u)) bdhOrdered.push(u);
  });

  const finalUsers = [...bdhOrdered, ...memberUsers];

  const rows = [];
  const bdhRowIndices = [];

  finalUsers.forEach((u, index) => {
    const isBdh = bdhOrdered.includes(u);
    if (isBdh) {
      bdhRowIndices.push(index + 1);
    }

    let deptDisplay = u.dept || u.projectGroup || 'BĐH';
    let posDisplay = u.position || u.leadershipTitle || (u.role === 'admin' ? 'President' : (u.role === 'organizer' ? 'Core' : 'Thành viên'));

    if (isBdh) {
      if (!deptDisplay.startsWith('BĐH')) deptDisplay = `BĐH - ${deptDisplay}`;
      if (posDisplay === 'vice_lead' || posDisplay === 'vice') posDisplay = 'Phó ban';
      if (!posDisplay.startsWith('BĐH')) posDisplay = `BĐH - ${posDisplay}`;
    }

    rows.push([
      deptDisplay,
      u.name || '',
      posDisplay,
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
  ], rows, -1, bdhRowIndices);
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
      const posLower = (r[2] || '').toLowerCase();
      const deptLower = (r[0] || '').toLowerCase();
      const isBtc = posLower.includes('core') || posLower.includes('vice') || posLower.includes('trưởng') || posLower.includes('phó') || posLower.includes('bđh') || deptLower.includes('bđh');
      const role = isBtc ? 'organizer' : 'member';
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
        role: role,
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
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountKey) return res.status(503).json({ error: 'Chưa cấu hình GOOGLE_SERVICE_ACCOUNT hoặc FIREBASE_SERVICE_ACCOUNT trên Vercel' });

    const db = ensureFirebase();

    const mode = req.query?.mode || req.body?.mode || 'two_way';
    const syncCore = req.query?.syncCore === 'true' || req.body?.syncCore === true;

    let pullResult = null;
    if ((mode === 'pull' || mode === 'two_way') && sidCore && syncCore) {
      pullResult = await pullFromSheets(db, sidCore);
    }

    const tasks = [];
    const names = [];

    if (sidCore && syncCore) {
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

    const errors = [];
    const report = results.map((r, i) => {
      if (r.status === 'rejected') {
        const errMsg = r.reason?.message || String(r.reason || 'Lỗi không xác định');
        errors.push(`${names[i]}: ${errMsg}`);
        return `${names[i]}: LỖI (${errMsg})`;
      }
      return `${names[i]}: OK`;
    });

    console.log('[HRSync]', report.join(' | '));

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: errors.join(' | '),
        report
      });
    }

    res.json({ success: true, mode, pullResult, report });
  } catch (err) {
    console.error('[HRSync] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
