const authHelper = require('../lib/ynda/auth');

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  return lines.map(parseCsvLine);
}

function rankingColumns(headerRow) {
  const map = { name: -1, role: -1, email: -1, phone: -1, ban: -1, facebook: -1, note: -1, school: -1, address: -1, gender: -1, dob: -1 };
  headerRow.forEach((col, idx) => {
    const c = String(col || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().trim();
    if (/ho va ten|ho ten|ten|fullname|name/.test(c) && !/fb|facebook/.test(c)) {
      if (map.name === -1) map.name = idx;
    }
    else if (/chuc vu|vi tri|vai tro|role|position|chuc danh/.test(c)) map.role = idx;
    else if (/ban|phong ban|bo phan|dept|department/.test(c) && !/facebook/.test(c)) map.ban = idx;
    else if (/email|mail/.test(c)) map.email = idx;
    else if (/so dien thoai|sdt|dien thoai|phone|tel/.test(c)) map.phone = idx;
    else if (/facebook|link fb|fb|link facebook/.test(c)) map.facebook = idx;
    else if (/ghi chu|note|notes/.test(c)) map.note = idx;
    else if (/truong|lop|school/.test(c)) map.school = idx;
    else if (/noi sinh song|dia chi|address|que quan/.test(c)) map.address = idx;
    else if (/gioi tinh|gender/.test(c)) map.gender = idx;
    else if (/ngay sinh|dob|birth/.test(c)) map.dob = idx;
  });
  return map;
}

function findRankingHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    if (!Array.isArray(row) || !row.length) continue;
    const cols = rankingColumns(row);
    if (cols.name !== -1 || (cols.email !== -1 && cols.role !== -1) || (cols.ban !== -1 && cols.role !== -1)) {
      return { row: i, cols };
    }
  }
  return null;
}

async function testExtraction() {
  const sid = '1SgbkoiSXP_zNYWN_AC6WKXTGQPbRAHfs2gwv_NOnsJM';
  const tabs = [
    { name: 'DATABASE CORE', url: `https://docs.google.com/spreadsheets/d/${sid}/gviz/tq?tqx=out:csv&sheet=DATABASE%20CORE` },
    { name: 'DATABASE THÀNH VIÊN', url: `https://docs.google.com/spreadsheets/d/${sid}/gviz/tq?tqx=out:csv&sheet=DATABASE%20TH%C3%80NH%20VI%C3%8AN` }
  ];

  let allMembers = [];
  const seenKeys = new Set();

  for (const t of tabs) {
    const res = await fetch(t.url);
    if (!res.ok) continue;
    const csv = await res.text();
    const rows = parseCsv(csv);
    const found = findRankingHeaderRow(rows);
    if (!found) continue;
    const { row: headerRow, cols } = found;

    let currentBan = '';
    for (let i = headerRow + 1; i < rows.length; i++) {
      const row = rows[i];
      const name = cols.name !== -1 ? String(row[cols.name] || '').trim() : '';
      if (!name || name.toLowerCase().includes('họ và tên') || name.toLowerCase().includes('database')) continue;

      if (cols.ban !== -1 && String(row[cols.ban] || '').trim()) {
        currentBan = String(row[cols.ban] || '').trim();
      }

      const rawRole = cols.role !== -1 ? String(row[cols.role] || '').trim() : '';
      const role = authHelper.mapRankingRole(rawRole, t.name);
      const email = cols.email !== -1 ? String(row[cols.email] || '').trim().toLowerCase() : '';
      const phone = cols.phone !== -1 ? String(row[cols.phone] || '').trim() : '';
      const facebook = cols.facebook !== -1 ? String(row[cols.facebook] || '').trim() : '';
      const notes = cols.note !== -1 ? String(row[cols.note] || '').trim() : '';
      const school = cols.school !== -1 ? String(row[cols.school] || '').trim() : '';
      const address = cols.address !== -1 ? String(row[cols.address] || '').trim() : '';
      const gender = cols.gender !== -1 ? String(row[cols.gender] || '').trim() : '';
      const dob = cols.dob !== -1 ? String(row[cols.dob] || '').trim() : '';

      const key = email || (name.toLowerCase() + '_' + currentBan.toLowerCase());
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        allMembers.push({
          name, role, rawRole, ban: currentBan, email, phone, facebook, notes, school, address, gender, dob, tab: t.name
        });
      }
    }
  }

  console.log(`\n=== TỔNG CỘNG ĐÃ LẤY ĐƯỢC ${allMembers.length} THÀNH VIÊN ===`);
  console.log('👑 Danh sách Ban Điều Hành / Admin:');
  allMembers.filter(m => m.role === 'FOUNDER' || m.role === 'PRESIDENT' || m.role === 'CO_FOUNDER').forEach(m => {
    console.log(`  - [${m.role}] ${m.name} (${m.rawRole}) | Ban: ${m.ban} | Email: ${m.email} | FB: ${m.facebook}`);
  });

  console.log('\n💼 Danh sách Ban Tổ Chức (Core / Vice / Trưởng Ban):');
  allMembers.filter(m => m.role === 'CORE' || m.role === 'VICE').forEach(m => {
    console.log(`  - [${m.role}] ${m.name} (${m.rawRole}) | Ban: ${m.ban} | Email: ${m.email} | FB: ${m.facebook}`);
  });

  console.log('\n🍿 Danh sách Thành viên cộng đồng:');
  console.log(`  Tổng số thành viên: ${allMembers.filter(m => m.role === 'MEMBER').length}`);
}

testExtraction();
