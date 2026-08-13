'use strict';

// =============================================================================
// YNDA XP LEDGER ENGINE
// -----------------------------------------------------------------------------
// Mọi điểm phát sinh được ghi vào XP_TRANSACTIONS dưới dạng transaction
// (XLI). Không lưu một con số Overall cố định. XP chỉ được tạo khi Human
// Review APPROVED (XXII). AI không được tự cộng điểm (XLIII).
//
// OVERALL (IV):
//   MEMBER : Task XP + Bonus XP - Penalty XP
//   CORE   : Task XP + Bonus XP - Penalty XP + Role Contribution
//   VICE   : Task XP + Bonus XP - Penalty XP + Role Contribution
//   Role Contribution = Role Point × 60%
// =============================================================================

const { store, uid } = require('./store');
const { SCHEMA } = require('./schema');
const { nowIso, round2, toNumber, parseJson } = require('./utils');
const config = require('./config');

const TAB = 'XP_TRANSACTIONS';
const USERS_TAB = 'USERS';

async function ensureTables() {
  const s = store();
  await s.ensureTable(TAB, SCHEMA.XP_TRANSACTIONS);
  await s.ensureTable(USERS_TAB, SCHEMA.USERS);
}

// -----------------------------------------------------------------------------
// Ghi một transaction vào XP ledger
// options:
//   user, type, sourceId, sourceName, rawPoint (điểm thô, có thể âm),
//   appliedPoint (điểm áp dụng vào Overall; với Role = rawPoint*0.6),
//   reviewer, notes, createdBy, isRolePoint, roleConversion,
//   roleRawPoint, roleOverallValue
//
// Quy tắc: nếu là Role Point thì IS_ROLE_POINT=TRUE, ROLE_CONVERSION=0.60,
// giữ nguyên ROLE_RAW_POINT và ROLE_OVERALL_VALUE. KHÔNG nhập sẵn 0.6 thay 1.
// =============================================================================
async function recordTxn({
  user, type, sourceId, sourceName, rawPoint, appliedPoint,
  reviewer, notes, createdBy, status = config.TXN_STATUS.APPLIED,
  isRolePoint = false, roleConversion = null, roleRawPoint = null,
  roleOverallValue = null, seasonId
}) {
  await ensureTables();
  const s = store();
  const raw = round2(toNumber(rawPoint));
  let applied = appliedPoint != null ? round2(toNumber(appliedPoint)) : raw;
  let countInOverall = true;

  if (isRolePoint) {
    // Role Point: APPLIED_POINT phải là giá trị đã quy đổi 60%
    if (roleConversion == null) roleConversion = config.ROLE.CONVERSION;
    if (roleRawPoint == null) roleRawPoint = raw;
    if (roleOverallValue == null) roleOverallValue = round2(raw * roleConversion);
    applied = round2(roleOverallValue);
    countInOverall = true;
  }

  const txn = {
    TRANSACTION_ID: uid('TXN'),
    USER_ID: user,
    TIME: nowIso(),
    TYPE: type,
    SOURCE_ID: sourceId || '',
    SOURCE_NAME: sourceName || '',
    RAW_POINT: raw,
    APPLIED_POINT: applied,
    STATUS: status,
    REVIEWER: reviewer || '',
    NOTES: notes || '',
    CREATED_BY: createdBy || '',
    IS_ROLE_POINT: isRolePoint ? 'TRUE' : 'FALSE',
    ROLE_CONVERSION: isRolePoint ? String(roleConversion) : '',
    ROLE_RAW_POINT: isRolePoint ? String(roleRawPoint) : '',
    ROLE_OVERALL_VALUE: isRolePoint ? String(applied) : '',
    COUNT_IN_OVERALL: countInOverall ? 'TRUE' : 'FALSE',
    SEASON_ID: seasonId || '',
    CREATED_AT: nowIso()
  };
  await s.insert(TAB, txn);
  return txn;
}

// Danh sách transaction được áp dụng (Applied) của user (theo mùa nếu có)
async function listAppliedTxns(userId, seasonId) {
  const rows = await store().list(TAB);
  return rows.filter(r => {
    if (String(r.USER_ID || '') !== String(userId)) return false;
    if (String(r.STATUS || '') !== config.TXN_STATUS.APPLIED) return false;
    if (String(r.COUNT_IN_OVERALL || 'TRUE') !== 'TRUE') return false;
    if (seasonId && String(r.SEASON_ID || '') !== String(seasonId)) return false;
    return true;
  });
}

// Toàn bộ transaction của user (đã áp dụng), kể cả lịch sử
async function listUserTxns(userId, opts = {}) {
  const rows = await store().list(TAB);
  let out = rows.filter(r => String(r.USER_ID || '') === String(userId));
  if (opts.seasonId) {
    out = out.filter(r => !opts.seasonId || String(r.SEASON_ID || '') === String(opts.seasonId));
  }
  if (opts.status) {
    out = out.filter(r => String(r.STATUS || '') === String(opts.status));
  }
  return out.sort((a, b) => String(a.TIME).localeCompare(String(b.TIME)));
}

// -----------------------------------------------------------------------------
// OVERALL COMPUTATION (IV)
//   Task XP      = tổng APPLIED_POINT với TYPE=TASK + TYPE=INTERACTION
//   Bonus XP     = tổng APPLIED_POINT với TYPE=BONUS
//   Penalty XP   = tổng APPLIED_POINT (âm) với TYPE=PENALTY
//   Role Point   = tổng ROLE_RAW_POINT của các txn ROLE
//   Role Contrib = tổng APPLIED_POINT của các txn ROLE (đã quy đổi 60%)
//   Overall Member = Task + Bonus + Penalty(âm)
//   Overall Core/Vice = như trên + Role Contribution
// =============================================================================
async function computeBreakdown(userId, opts = {}) {
  const txns = await listAppliedTxns(userId, opts.seasonId);
  const user = await store().get(USERS_TAB, 'USER_ID', String(userId));
  const role = config.normalizeRole(user && user.ROLE);

  let taskXp = 0, bonusXp = 0, penaltyXp = 0, rolePoint = 0, roleContribution = 0;
  let completedCount = 0;

  for (const t of txns) {
    const type = String(t.TYPE || '').toUpperCase();
    const applied = toNumber(t.APPLIED_POINT);
    if (type === config.XP_TYPES.TASK || type === config.XP_TYPES.INTERACTION) {
      taskXp += applied;
    } else if (type === config.XP_TYPES.BONUS) {
      bonusXp += applied;
    } else if (type === config.XP_TYPES.PENALTY) {
      penaltyXp += applied; // âm
    } else if (type === config.XP_TYPES.ROLE) {
      rolePoint += toNumber(t.ROLE_RAW_POINT);
      roleContribution += applied;
      completedCount += 0; // role không tính completed task
    }
    if (String(t.SOURCE_ID || '').startsWith('TASK-') || String(t.SOURCE_ID || '').startsWith('MEDIA-') || String(t.SOURCE_ID || '').startsWith('TRU-') || String(t.SOURCE_ID || '').startsWith('ND-') || String(t.SOURCE_ID || '').startsWith('DBAI-')) {
      if (type === config.XP_TYPES.TASK && applied >= 0) completedCount += 1;
    }
  }

  const base = taskXp + bonusXp + penaltyXp;
  let overall = base;
  const isRoleHolder = role === config.ROLES.CORE || role === config.ROLES.VICE;
  if (isRoleHolder) overall += roleContribution;

  // Member không có Role Point (IV). Nếu user là MEMBER nhưng có txn ROLE,
  // không cộng vào Overall (bảo vệ dữ liệu sai).
  if (!isRoleHolder) {
    overall = base;
    roleContribution = 0;
  }

  return {
    userId,
    role,
    taskXp: round2(taskXp),
    bonusXp: round2(bonusXp),
    penaltyXp: round2(penaltyXp),
    rolePoint: round2(rolePoint),
    roleContribution: round2(roleContribution),
    overall: round2(overall)
  };
}

// Tổng hợp toàn user (dùng cho Leaderboard)
async function computeAllBreakdowns(seasonId) {
  const users = await store().list(USERS_TAB);
  const output = [];
  for (const u of users) {
    if (String(u.STATUS || '') === 'ARCHIVED') continue;
    const b = await computeBreakdown(u.USER_ID, { seasonId });
    output.push({ ...u, ...b });
  }
  return output;
}

// -----------------------------------------------------------------------------
// PENALTY ENGINE (XIII)
//   Trước Work Start: 0
//   Sau Work Start:   -Task XP × Progress Time %
//   Quá deadline:     -2 × Task XP
//   XP có thể âm
// =============================================================================
function computePenalty({ taskXp, workStart, submissionDeadline, atIso }) {
  const { parseDate, progressPct, isOverdue } = require('./utils');
  const at = parseDate(atIso || nowIso());
  const ws = parseDate(workStart);
  const sd = parseDate(submissionDeadline);

  if (!ws || !sd) return 0;
  if (at.getTime() < ws.getTime()) return 0; // trước Work Start
  if (at.getTime() > sd.getTime()) return config.PENALTY.xpOverdeadline(taskXp); // quá deadline

  // Sau workStart, trong cửa sổ làm việc: penalty theo % thời gian đã trôi
  const pct = progressPct(workStart, submissionDeadline, atIso);
  return config.PENALTY.xpAtProgress(taskXp, pct);
}

module.exports = {
  TAB,
  recordTxn,
  listAppliedTxns,
  listUserTxns,
  computeBreakdown,
  computeAllBreakdowns,
  computePenalty,
  ensureTables,
};