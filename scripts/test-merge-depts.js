const authHelper = require('../lib/ynda/auth');

function canonicalDept(dept, title, role) {
  const t = (String(dept || '') + ' ' + String(title || '') + ' ' + String(role || '')).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd');
  if (/ban dieu hanh|bdh|dieu hanh|founder|president|chu tich|sang lap|admin|global/.test(t)) return 'Ban Điều Hành';
  if (/nhan su|hr/.test(t)) return 'Ban Nhân Sự';
  if (/truyen thong|comms|mkt|marketing|pr/.test(t)) return 'Ban Truyền Thông';
  if (/media|hau ky|san xuat|video|design/.test(t)) return 'Ban Media / Hậu Kỳ';
  if (/noi dung/.test(t)) return 'Ban Nội Dung';
  if (/duyet|kiem duyet/.test(t)) return 'Ban Duyệt Bài';
  return 'Ban Khác';
}

function sanitizeFbUrl(fb, name) {
  if (!fb || typeof fb !== 'string') return '';
  const trimmed = fb.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/facebook\.com/i.test(trimmed)) return 'https://' + trimmed.replace(/^https?:\/\//i, '');
  return `https://www.facebook.com/search/top?q=${encodeURIComponent(trimmed || name)}`;
}

async function testDeptMerge() {
  const members = await authHelper.readRankingMembers(null, '1SgbkoiSXP_zNYWN_AC6WKXTGQPbRAHfs2gwv_NOnsJM');
  const depts = {};

  members.forEach(m => {
    const d = canonicalDept(m.ban, m.rawRole, m.role);
    if (!depts[d]) depts[d] = { leads: [], members: [] };
    const isExec = m.role === 'FOUNDER' || m.role === 'CO_FOUNDER' || m.role === 'PRESIDENT';
    const isLead = !isExec && (m.role === 'CORE' || m.role === 'VICE');
    const fbUrl = sanitizeFbUrl(m.facebook, m.name);
    
    if (isExec || isLead) {
      depts[d].leads.push({ name: m.name, role: m.rawRole || m.role, fb: fbUrl });
    } else {
      depts[d].members.push({ name: m.name, role: m.rawRole || m.role, fb: fbUrl });
    }
  });

  console.log('=== KẾT QUẢ GOM BAN CHUẨN XÁC ===');
  Object.keys(depts).forEach(k => {
    console.log(`\n🏢 ${k}:`);
    console.log(`   ⭐ Trưởng/Phó Ban (${depts[k].leads.length}):`, depts[k].leads.map(l => l.name + ' [' + l.role + ']').join(', ') || 'Chưa có');
    console.log(`   👥 Thành viên (${depts[k].members.length}):`, depts[k].members.map(m => m.name + ' (FB: ' + m.fb + ')').join(', ') || 'Chưa có');
  });
}

testDeptMerge();
