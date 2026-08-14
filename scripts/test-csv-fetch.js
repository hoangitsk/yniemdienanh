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

async function testFetchAndParse() {
  const sid = '1SgbkoiSXP_zNYWN_AC6WKXTGQPbRAHfs2gwv_NOnsJM';
  const tabs = [
    { name: 'DATABASE CORE', url: `https://docs.google.com/spreadsheets/d/${sid}/gviz/tq?tqx=out:csv&sheet=DATABASE%20CORE` },
    { name: 'DATABASE THÀNH VIÊN', url: `https://docs.google.com/spreadsheets/d/${sid}/gviz/tq?tqx=out:csv&sheet=DATABASE%20TH%C3%80NH%20VI%C3%8AN` }
  ];

  let allMembers = [];

  for (const t of tabs) {
    try {
      const res = await fetch(t.url);
      if (!res.ok) continue;
      const csvText = await res.text();
      const rows = parseCsv(csvText);
      if (rows.length < 2) continue;

      const headerIdx = authHelper.findRankingHeaderRow(rows);
      const headers = rows[headerIdx];
      const colMap = authHelper.rankingColumns(headers);

      console.log(`\n=== Tab: ${t.name} (Found ${rows.length - headerIdx - 1} rows) ===`);
      console.log('Header Row:', headerIdx, 'ColMap:', colMap);

      for (let r = headerIdx + 1; r < rows.length; r++) {
        const row = rows[r];
        const name = colMap.name !== -1 ? String(row[colMap.name] || '').trim() : '';
        if (!name || name.toLowerCase().includes('họ và tên') || name.toLowerCase().includes('database')) continue;

        const rawRole = colMap.role !== -1 ? String(row[colMap.role] || '').trim() : '';
        const role = authHelper.mapRankingRole(rawRole, t.name);
        const ban = colMap.ban !== -1 ? String(row[colMap.ban] || '').trim() : '';
        const email = colMap.email !== -1 ? String(row[colMap.email] || '').trim().toLowerCase() : '';
        const phone = colMap.phone !== -1 ? String(row[colMap.phone] || '').trim() : '';
        const facebook = colMap.facebook !== -1 ? String(row[colMap.facebook] || '').trim() : '';
        const notes = colMap.note !== -1 ? String(row[colMap.note] || '').trim() : '';

        const member = { name, role, rawRole, ban, email, phone, facebook, notes, tab: t.name };
        allMembers.push(member);
        console.log(`[${role}] ${name} | Ban: ${ban} | Vị trí: ${rawRole} | Email: ${email} | FB: ${facebook.slice(0, 30)}`);
      }
    } catch (e) {
      console.error('Error parsing tab', t.name, e.message);
    }
  }

  console.log(`\n🎉 Total parsed members from sheet: ${allMembers.length}`);
}

testFetchAndParse();
