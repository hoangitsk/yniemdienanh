'use strict';

// =============================================================================
// YNDA LEADERBOARD ENGINE (XXXVII, XXXVIII)
// -----------------------------------------------------------------------------
// 🏆 Overall Ranking — xếp theo Overall Contribution Score
// ⭐ Core — chỉ Core/Vice  |  👥 Thành viên — member only
// 📅 Theo tháng — điểm phát sinh trong tháng  |  🏅 Top mỗi Ban
// Role Point hiển thị giá trị gốc; Role Contribution hiển thị giá trị đã
// quy đổi 60%. Không tạo bảng Production riêng.
// =============================================================================

const { store, uid } = require('./store');
const { SCHEMA } = require('./schema');
const config = require('./config');
const { nowIso, round2, toNumber, parseJson } = require('./utils');
const xp = require('./xp');

const USERS_TAB = 'USERS';
const LB_TAB = 'LEADERBOARDS';

async function ensureTables() {
  const s = store();
  await s.ensureTable(USERS_TAB, SCHEMA.USERS);
  await s.ensureTable(LB_TAB, SCHEMA.LEADERBOARDS);
}

// Xếp hạng. Phân nhóm: overall vs core/vice vs member vs theo ban vs theo tháng.
async function buildLeaderboard({ seasonId, periodMonth, department, role } = {}) {
  await ensureTables();
  const users = await store().list(USERS_TAB);

  // Mặc định tháng hiện tại nếu không chỉ định periodMonth cho Monthly Ranking
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const effectiveMonth = periodMonth || currentMonthStr;

  const entries = [];
  const monthlyEntries = [];

  for (const u of users) {
    if (String(u.STATUS || '') === 'ARCHIVED') continue;

    // Overall breakdown
    const b = await xp.computeBreakdown(u.USER_ID, { seasonId });
    entries.push({
      userId: u.USER_ID,
      name: u.NAME,
      role: config.normalizeRole(u.ROLE),
      department: u.DEPARTMENT || 'GLOBAL',
      overall: b.overall,
      taskXp: b.taskXp,
      bonusXp: b.bonusXp,
      penaltyXp: b.penaltyXp,
      rolePoint: b.rolePoint,
      roleContribution: b.roleContribution,
      completedTasks: b.completedTasks || 0,
      qualityScore: b.qualityScore || 95
    });

    // Monthly breakdown (chỉ tính điểm phát sinh trong tháng)
    const mb = await xp.computeBreakdown(u.USER_ID, { seasonId, periodMonth: effectiveMonth });
    monthlyEntries.push({
      userId: u.USER_ID,
      name: u.NAME,
      role: config.normalizeRole(u.ROLE),
      department: u.DEPARTMENT || 'GLOBAL',
      overall: mb.overall,
      taskXp: mb.taskXp,
      bonusXp: mb.bonusXp,
      penaltyXp: mb.penaltyXp,
      rolePoint: mb.rolePoint,
      roleContribution: mb.roleContribution,
      completedTasks: mb.completedTasks || 0,
      qualityScore: mb.qualityScore || 95
    });
  }

  const rank = (arr) => arr
    .sort((a, b) => b.overall - a.overall || String(a.name).localeCompare(String(b.name), 'vi'))
    .map((e, i) => ({ ...e, rank: i + 1 }));

  const all = rank(entries);
  const core = rank(entries.filter(e => [config.ROLES.CORE, config.ROLES.VICE].includes(e.role)));
  const members = rank(entries.filter(e => !core.some(c => c.userId === e.userId)));
  const monthly = rank(monthlyEntries);

  // Top theo Ban (5 Ban chính)
  const byDept = {};
  for (const dept of config.DEPARTMENTS) {
    if (dept === 'GLOBAL') continue;
    const entriesInDept = entries.filter(e => String(e.department || '') === dept);
    byDept[dept] = rank(entriesInDept);
  }

  // Kết quả filtered tùy chọn nếu user chọn filter riêng
  let filtered = [...entries];
  if (department && department !== 'ALL') {
    filtered = filtered.filter(e => String(e.department || '').toUpperCase() === department.toUpperCase());
  }
  if (role && role !== 'ALL') {
    if (role === 'CORE_GROUP') {
      filtered = filtered.filter(e => [config.ROLES.CORE, config.ROLES.VICE].includes(e.role));
    } else {
      filtered = filtered.filter(e => e.role === role);
    }
  }
  filtered = rank(filtered);

  return {
    all,
    core,
    members,
    monthly,
    byDept,
    filtered,
    periodMonth: effectiveMonth,
    summary: {
      totalMembers: entries.length,
      coreCount: core.length,
      memberCount: members.length,
      topLeader: all[0] || null
    }
  };
}

module.exports = { buildLeaderboard, ensureTables };