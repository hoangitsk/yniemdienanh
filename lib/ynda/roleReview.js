'use strict';

// =============================================================================
// YNDA WEEKLY ROLE REVIEW ENGINE (V, VI, XLV)
// -----------------------------------------------------------------------------
// Mỗi tuần Core/Vice được review. AI đánh giá dữ liệu hoạt động và CHỈ đề
// xuất (không tự giảm/tăng Role Point). Founder duyệt cuối.
//
// Mỗi tuần phải tạo record trong ROLE_REVIEWS VÀ đồng thời ghi transaction
// vào XP ledger sau khi approved. Google Sheets PHẢI có flag:
//   TYPE=ROLE, IS_ROLE_POINT=TRUE, ROLE_CONVERSION=0.60,
//   ROLE_RAW_POINT, ROLE_OVERALL_VALUE, COUNT_IN_OVERALL=TRUE
// KHÔNG nhập sẵn +0.6 thay cho +1. KHÔNG cộng Role Point 1:1 vào Overall.
// =============================================================================

const { store, uid } = require('./store');
const { SCHEMA } = require('./schema');
const config = require('./config');
const { nowIso, round2, toNumber, parseJson } = require('./utils');
const xp = require('./xp');
const audit = require('./audit');

const TAB = 'ROLE_REVIEWS';

async function ensureTables() {
  await store().ensureTable(TAB, SCHEMA.ROLE_REVIEWS);
}

// Key tuần: Thứ 2 đầu tiên của tuần (ISO)
function weekKey(date) {
  const d = date ? new Date(date) : new Date();
  const day = (d.getDay() + 6) % 7; // Thứ 2 = 0
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  const pad = n => String(n).padStart(2, '0');
  return `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
}

async function createReview({ seasonId, team, memberId, memberName, role, reviewer, defaultPoint, note }) {
  await ensureTables();
  const week = weekKey();
  const existing = await store().query(TAB, r =>
    String(r.WEEK || '') === String(week) &&
    String(r.MEMBER_ID || '') === String(memberId) &&
    String(r.SEASON_ID || '') === String(seasonId || ''));
  if (existing.length) return existing[0];

  const defaultRolePoint = defaultPoint != null
    ? toNumber(defaultPoint)
    : config.ROLE.DEFAULT_WEEKLY[role] || 0;

  const record = {
    REVIEW_ID: uid('RVR'),
    SEASON_ID: seasonId || '',
    WEEK: week,
    TEAM: team || '',
    MEMBER_ID: memberId,
    MEMBER_NAME: memberName || '',
    ROLE: role || '',
    DEFAULT_ROLE_POINT: round2(defaultRolePoint),
    AI_RECOMMENDED: round2(defaultRolePoint),
    AI_REASON: '',
    FINAL_ROLE_POINT: '',
    REVIEWER: reviewer || '',
    STATUS: 'DRAFT',
    NOTE: note || '',
    CREATED_AT: nowIso(),
    UPDATED_AT: nowIso()
  };
  await store().insert(TAB, record);
  return record;
}

async function aiRecommend(reviewId, recommended, reason, actor) {
  const s = store();
  const r = await s.get(TAB, 'REVIEW_ID', String(reviewId));
  if (!r) throw new Error('Role review không tồn tại.');

  const updated = await s.update(TAB, 'REVIEW_ID', String(reviewId), {
    AI_RECOMMENDED: round2(toNumber(recommended)),
    AI_REASON: reason || '',
    STATUS: 'AI_PROPOSED',
    UPDATED_AT: nowIso()
  });
  await audit.log({ actor: actor || 'AI', action: 'ROLE_REVIEW', entityType: 'ROLE_REVIEWS', entityId: reviewId, after: { aiRecommended: recommended, reason } });
  return updated;
}

// -----------------------------------------------------------------------------
// APPROVE — Founder quyết định cuối. Sau khi approved:
//   1) ghi FINAL_ROLE_POINT vào ROLE_REVIEWS
//   2) ghi transaction ROLE vào XP ledger với đầy đủ flag
// =============================================================================
async function approve(reviewId, reviewer, finalPoint, note) {
  await ensureTables();
  const s = store();
  const r = await s.get(TAB, 'REVIEW_ID', String(reviewId));
  if (!r) throw new Error('Role review không tồn tại.');

  const final = round2(toNumber(finalPoint != null ? finalPoint : r.AI_RECOMMENDED));
  const updated = await s.update(TAB, 'REVIEW_ID', String(reviewId), {
    FINAL_ROLE_POINT: final,
    REVIEWER: reviewer || '',
    STATUS: 'APPROVED',
    NOTE: note != null ? note : r.NOTE,
    UPDATED_AT: nowIso()
  });

  // Ghi transaction ROLE với flag đầy đủ
  const txn = await xp.recordTxn({
    user: r.MEMBER_ID,
    type: config.XP_TYPES.ROLE,
    sourceId: r.REVIEW_ID,
    sourceName: `Role ${r.ROLE} Week ${r.WEEK} — ${r.TEAM || ''}`.trim(),
    rawPoint: final, // Role Point gốc (VD: +1)
    appliedPoint: null, // sẽ được tính 60% bởi recordTxn
    reviewer,
    notes: `Role Review ${r.REVIEW_ID} approved. Raw=${final}, Conversion=60%`,
    createdBy: reviewer,
    isRolePoint: true,
    roleConversion: config.ROLE.CONVERSION,
    roleRawPoint: final,
    roleOverallValue: round2(final * config.ROLE.CONVERSION),
    seasonId: r.SEASON_ID
  });

  await audit.log({
    actor: reviewer, action: 'ROLE_REVIEW', entityType: 'ROLE_REVIEWS', entityId: reviewId,
    after: { finalRolePoint: final, txnId: txn.TRANSACTION_ID, conversion: config.ROLE.CONVERSION }
  });

  return { ...updated, XP_TXN: txn };
}

// Tự tạo + AI đề xuất hàng loạt cho toàn bộ Core/Vice trong 1 tuần
async function autoGenerateWeeklyReviews({ seasonId, users, reviewer, gemini }) {
  const week = weekKey();
  const members = (users || []).filter(u =>
    [config.ROLES.CORE, config.ROLES.VICE].includes(config.normalizeRole(u.ROLE)));

  const results = [];
  for (const u of members) {
    const r = await createReview({
      seasonId, team: u.DEPARTMENT, memberId: u.USER_ID, memberName: u.NAME,
      role: u.ROLE, reviewer, note: ''
    });
    if (r && r.STATUS === 'DRAFT') {
      const weekData = await collectWeekData(u.USER_ID, week);
      const ai = await require('./ai').recommendRolePoint({
        team: u.DEPARTMENT, role: u.ROLE, weekData, gemini
      });
      await aiRecommend(r.REVIEW_ID, ai.recommended, ai.reason, reviewer);
      results.push({ ...r, AI_RECOMMENDED: ai.recommended, AI_REASON: ai.reason });
    } else if (r) {
      results.push(r);
    }
  }
  return { week, results };
}

// Thu thập dữ liệu hoạt động tuần của user (để AI đề xuất có căn cứ)
async function collectWeekData(userId, week) {
  const subs = await store().query('TASK_SUBMISSIONS', r => String(r.USER_ID || '') === String(userId));
  const tasks = await store().list('TASKS');
  const completed = subs.filter(s => s.STATUS === config.SUBMISSION_STATUS.APPROVED).length;
  const missed = subs.filter(s => s.STATUS === config.SUBMISSION_STATUS.REJECTED).length;
  const totalTasks = tasks.filter(t => String(t.CREATED_BY || '') === String(userId)).length;
  const penalties = await store().query('XP_TRANSACTIONS', r =>
    String(r.USER_ID || '') === String(userId) && r.TYPE === config.XP_TYPES.PENALTY);
  return {
    week,
    submissionsCompleted: completed,
    submissionsRejected: missed,
    tasksCreated: totalTasks,
    penaltyCount: penalties.length,
    penaltyTotalXp: penalties.reduce((s, p) => s + toNumber(p.APPLIED_POINT), 0)
  };
}

async function listReviews(filter = {}) {
  let rows = await store().list(TAB);
  if (filter.seasonId) rows = rows.filter(r => String(r.SEASON_ID || '') === String(filter.seasonId));
  if (filter.week) rows = rows.filter(r => String(r.WEEK || '') === String(filter.week));
  if (filter.memberId) rows = rows.filter(r => String(r.MEMBER_ID || '') === String(filter.memberId));
  if (filter.status) rows = rows.filter(r => String(r.STATUS || '') === String(filter.status));
  return rows;
}

module.exports = { TAB, createReview, aiRecommend, approve, autoGenerateWeeklyReviews, listReviews, weekKey, ensureTables };