const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// Tải cấu hình môi trường từ .env và .env.local
require('dotenv').config();
if (fs.existsSync(path.join(__dirname, '.env.local'))) {
  require('dotenv').config({ path: path.join(__dirname, '.env.local'), override: true });
}

function ensureFirebase() {
  if (admin.apps.length) return admin.firestore();
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    return null;
  }
  try {
    let s = raw.trim();
    if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
    let acc = JSON.parse(s);
    if (typeof acc === 'string') acc = JSON.parse(acc);
    acc.private_key = acc.private_key.replace(/\\n/g, '\n');
    admin.initializeApp({ credential: admin.credential.cert(acc) });
    return admin.firestore();
  } catch (e) {
    console.error('⚠️ Lỗi giải mã FIREBASE_SERVICE_ACCOUNT:', e.message);
    return null;
  }
}

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function escapeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function writeCsv(filePath, headers, rows) {
  const BOM = '\uFEFF'; // UTF-8 BOM cho Excel & Google Sheets hiển thị tiếng Việt không bị lỗi font
  const headerLine = headers.map(escapeCsvCell).join(',');
  const dataLines = rows.map(r => r.map(escapeCsvCell).join(','));
  const csvContent = BOM + [headerLine, ...dataLines].join('\r\n');
  fs.writeFileSync(filePath, csvContent, 'utf8');
}

async function runExport() {
  console.log('----------------------------------------------------');
  console.log('🚀 CÔNG CỤ TRÍCH XUẤT DATABASE SANG GOOGLE SHEETS / EXCEL (YNDA)');
  console.log('📌 Phụ trách HR: Huyền Trang (Core HR)');
  console.log('----------------------------------------------------');

  const exportDir = path.join(__dirname, 'exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  // 1. Luôn xuất danh sách Core Team & HR
  console.log('👑 Tạo file cấu hình Core Team & HR...');
  const coreHeaders = ['Họ tên', 'Email', 'Chức danh / Ban', 'Vai trò / Nhiệm vụ'];
  const coreRows = [
    ['Quỳnh Giang', 'quynhgiang@yniemdienanh.com', 'Core Comms | K08', 'Truyền thông chính'],
    ['Yến Nhi', 'yennhi@yniemdienanh.com', 'Core Media | 09', 'Phụ trách Media'],
    ['Thanh Nga', 'thanhnga@yniemdienanh.com', 'Co - Founder | K10', 'Đồng sáng lập'],
    ['Huyền Trang', 'huyentrang.hr@yniemdienanh.com', 'Core HR', 'Quản lý Nhân sự & Phỏng vấn'],
    ['Minh Hoàng', 'minhhoang@yniemdienanh.com', 'Founder | K08', 'Sáng lập dự án'],
    ['Minh Anh', 'minhanh@yniemdienanh.com', 'President | K10', 'Chủ tịch'],
    ['Hữu Bình', 'huubinh@yniemdienanh.com', 'Core Nội dung | K06', 'Phụ trách Nội dung'],
    ['Ngọc Diệp', 'ngocdiep@yniemdienanh.com', 'Core duyệt bài | K10', 'Duyệt bài & Kiểm duyệt']
  ];
  writeCsv(path.join(exportDir, 'core_team_hr.csv'), coreHeaders, coreRows);
  console.log(`  ✅ Đã xuất: ${path.join(exportDir, 'core_team_hr.csv')}`);

  const db = ensureFirebase();

  if (!db) {
    console.log('');
    console.log('⚠️ CHÚ Ý: Chưa tìm thấy biến môi trường FIREBASE_SERVICE_ACCOUNT trong .env.');
    console.log('👉 Hướng dẫn cho Huyền Trang / Admin:');
    console.log('  1️⃣ Bạn có thể đăng nhập trên Website (dashboard.html hoặc schedule.html)');
    console.log('  2️⃣ Bấm nút "📥 Xuất dữ liệu Database (CSV / Sheet)" trên giao diện Admin');
    console.log('  3️⃣ Hoặc thêm FIREBASE_SERVICE_ACCOUNT vào file .env để chạy lệnh trích xuất tự động này.');
    console.log('----------------------------------------------------');
    return;
  }

  // 2. Trích xuất Ứng viên
  console.log('📦 Đang tải danh sách Ứng viên (Applications)...');
  const appsSnap = await db.collection('applications').get();
  const usersSnap = await db.collection('users').get();
  const usersMap = new Map();
  usersSnap.forEach(d => usersMap.set(d.id, d.data()));

  const appHeaders = [
    'Mã ứng viên', 'Họ và tên', 'Email', 'Ban ứng tuyển', 'Vị trí',
    'Loại đơn', 'Giai đoạn', 'Trạng thái', 'Ngày đăng ký',
    'UID tài khoản', 'Trạng thái PV', 'SĐT', 'Giới thiệu'
  ];
  const appRows = [];
  appsSnap.forEach(d => {
    const a = d.data();
    const u = usersMap.get(a.approvedUserId || '') || usersMap.get(d.id) || {};
    appRows.push([
      d.id,
      a.name || u.displayName || u.name || '',
      a.email || u.email || '',
      a.dept || a.department || '',
      a.position || '',
      a.type || '',
      a.recruitmentStage || '',
      a.status || 'pending',
      formatDate(a.createdAt || a.timestamp),
      a.approvedUserId || d.id,
      u.interviewStatus || a.interviewStatus || '',
      a.phone || u.phone || '',
      a.intro || a.vision || ''
    ]);
  });
  writeCsv(path.join(exportDir, 'applications_ung_vien.csv'), appHeaders, appRows);
  console.log(`  ✅ Đã trích xuất ${appRows.length} ứng viên -> exports/applications_ung_vien.csv`);

  // 3. Trích xuất Tài khoản Người dùng
  console.log('👥 Đang tải danh sách Tài khoản (Users)...');
  const userHeaders = [
    'UID', 'Họ và tên', 'Email', 'Vai trò (Role)', 'Ban',
    'Chức danh', 'Tình trạng PV', 'Số điện thoại', 'Nhóm dự án', 'Ngày tạo'
  ];
  const userRows = [];
  usersSnap.forEach(d => {
    const u = d.data();
    userRows.push([
      d.id,
      u.displayName || u.name || u.fullName || '',
      u.email || '',
      u.role || 'member',
      u.dept || u.department || '',
      u.position || u.title || '',
      u.interviewStatus || '',
      u.phone || '',
      u.projectGroup || '',
      formatDate(u.createdAt)
    ]);
  });
  writeCsv(path.join(exportDir, 'users_tai_khoan.csv'), userHeaders, userRows);
  console.log(`  ✅ Đã trích xuất ${userRows.length} tài khoản -> exports/users_tai_khoan.csv`);

  // 4. Trích xuất Lịch phỏng vấn
  console.log('📅 Đang tải Lịch phỏng vấn (Scheduled Events)...');
  const scheduleSnap = await db.collection('scheduledEvents').get();
  const scheduleHeaders = [
    'Mã sự kiện', 'Thời gian bắt đầu', 'Tên ứng viên', 'Email ứng viên',
    'Vị trí', 'Ban', 'HR phụ trách', 'Email HR',
    'Trạng thái', 'Loại', 'Thời lượng (phút)', 'Link Meet', 'Ngày hoàn thành'
  ];
  const scheduleRows = [];
  scheduleSnap.forEach(d => {
    const s = d.data();
    scheduleRows.push([
      d.id,
      formatDate(s.startAt),
      s.candidateName || '',
      s.candidateEmail || '',
      s.candidatePosition || '',
      s.candidateDepartment || '',
      s.assignedHrName || '',
      s.assignedHrEmail || '',
      s.status || '',
      s.type || '',
      s.duration || 30,
      s.meetUrl || s.googleMeetLink || '',
      formatDate(s.completedAt)
    ]);
  });
  writeCsv(path.join(exportDir, 'scheduled_events_lich_pv.csv'), scheduleHeaders, scheduleRows);
  console.log(`  ✅ Đã trích xuất ${scheduleRows.length} lịch PV -> exports/scheduled_events_lich_pv.csv`);

  // 5. Trích xuất Staff Points & Audit Logs
  try {
    const pointsSnap = await db.collection('staffPoints').get();
    const pointHeaders = ['Tên', 'Ban', 'Điểm', 'Lý do', 'Nguồn', 'Mã nguồn', 'Ngày tạo'];
    const pointRows = [];
    pointsSnap.forEach(d => {
      const p = d.data();
      pointRows.push([p.userName || '', p.dept || '', p.points || 0, p.reason || '', p.sourceType || '', p.sourceId || '', formatDate(p.createdAt)]);
    });
    writeCsv(path.join(exportDir, 'staff_points.csv'), pointHeaders, pointRows);
  } catch (e) {}

  console.log('');
  console.log('🎉 TRÍCH XUẤT THÀNH CÔNG!');
  console.log('📂 Tất cả các file CSV đã sẵn sàng tại thư mục: ' + exportDir);

  if (process.env.GOOGLE_SERVICE_ACCOUNT && process.env.SPREADSHEET_HR_DASHBOARD) {
    console.log('📊 Đang tự động đẩy dữ liệu lên Google Sheets HR Dashboard...');
    try {
      const syncHandler = require('./api/hr/sync-to-sheets');
      await new Promise((resolve) => {
        syncHandler({ headers: {} }, { status: () => ({ json: resolve }), json: resolve });
      });
      console.log('✅ Đã đồng bộ Google Sheets thành công!');
    } catch (e) {
      console.warn('⚠️ Không thể tự động đồng bộ Google Sheets:', e.message);
    }
  }
}

runExport().catch(err => {
  console.error('❌ Lỗi:', err);
});
