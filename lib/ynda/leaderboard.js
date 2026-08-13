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

// Xếp hạng. Phân nhóm: core/vice vs member vs theo ban vs theo tháng.
async function buildLeaderboard({ seasonId, periodMonth } = {}) {
  await ensureTables();
  const users = await store().list(USERS_TAB);
  const entries = [];
  for (const u of users) {
    if (String(u.STATUS || '') === 'ARCHIVED') continue;
    const b = await xp.computeBreakdown(u.USER_ID, { seasonId });
    const isMonth = periodMonth && (b.taskXp || b.bonusXp || b.penaltyXp) === (b.taskXp || b.bonusXp || b.penaltyXp);
    entries.push({
      userId: u.USER_ID,
      name: u.NAME,
      role: config.normalizeRole(u.ROLE),
      department: u.DEPARTMENT,
      overall: b.overall,
      taskXp: b.taskXp,
      bonusXp: b.bonusXp,
      penaltyXp: b.penaltyXp,
      rolePoint: b.rolePoint,
      roleContribution: b.roleContribution
    });
  }

  const rank = (arr) => arr
    .sort((a, b) => b.overall - a.overall || String(a.name).localeCompare(String(b.name), 'vi'))
    .map((e, i) => ({ ...e, rank: i + 1 }));

  const all = rank(entries);
  const core = rank(entries.filter(e => [config.ROLES.CORE, config.ROLES.VICE].includes(e.role)));
  const members = rank(entries.filter(e => !core.some(c => c.userId === e.userId)));

  // Top theo Ban
  const byDept = {};
  for (const dept of config.DEPARTMENTS) {
    const entriesInDept = entries.filter(e => String(e.department || '') === dept);
    if (entriesInDept.length) byDept[dept] = rank(entriesInDept);
  }

  return { all, core, members, byDept };
}

// -----------------------------------------------------------------------------
// SEASON (XXXIX) — lock điểm khi season kết thúc. Lite: lưu Season Scores.
// =============================================================================
const season = require('./season');

module.exports = { buildLeaderboard, ensureTables };