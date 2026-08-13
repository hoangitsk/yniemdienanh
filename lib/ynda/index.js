'use strict';

// =============================================================================
// YNDA SERVICE — facade điều phối toàn bộ engines
// =============================================================================

const config = require('./config');
const store = require('./store');
const schema = require('./schema');
const audit = require('./audit');
const xp = require('./xp');
const auth = require('./auth');
const tasks = require('./tasks');
const claims = require('./claims');
const assignments = require('./assignments');
const submissions = require('./submissions');
const ai = require('./ai');
const roleReview = require('./roleReview');
const bonus = require('./bonus');
const leaderboard = require('./leaderboard');
const season = require('./season');
const production = require('./production');
const notifications = require('./notifications');
const templates = require('./templates');
const { nowIso, round2, toNumber } = require('./utils');
// drive được load động để không crash khi thiếu quyền drive trong test

const SCHEMA = schema.SCHEMA;

async function bootstrap({ mode = 'memory', spreadsheetId, serviceAccountKey } = {}) {
  store.initStore({ mode, spreadsheetId, serviceAccountKey });
  const s = store.store();
  // Đảm bảo các tab chính tồn tại (USERS, ... theo XXXV)
  await Promise.all(Object.entries(SCHEMA).map(([tab, headers]) =>
    s.ensureTable(tab, headers).catch(() => {})));
  await s.ensureTable('COUNTERS', ['KEY', 'VALUE']);
  return s;
}

function geminiFactory() {
  let lib = null;
  try { lib = require('./gemini'); } catch (e) {}
  if (!lib) return null;
  return (prompt) => lib.generateGeminiJson(prompt);
}

// ------------------------------------------------ đọc dữ liệu quan hệ và tổng hợp Dashboard
async function getDashboard(userId) {
  const user = await store.store().get('USERS', 'USER_ID', String(userId));
  const userRole = config.normalizeRole(user && user.ROLE);
  const userDept = (user && user.DEPARTMENT) || 'GLOBAL';

  const breakdown = await xp.computeBreakdown(userId);
  const myClaims = await claims.listClaims({ userId });
  const myAssignments = await assignments.listAssignments({ assignee: userId });
  const recentTxns = (await xp.listUserTxns(userId)).slice(-5).reverse();

  const allTasks = await tasks.listTasks({});
  const nowTime = Date.now();

  const openTasks = allTasks.filter(t => t.STATUS === config.TASK_STATUS.OPEN);
  const mandatoryTasks = allTasks.filter(t => t.SCOPE === config.TASK_TYPES.MANDATORY && t.STATUS !== config.TASK_STATUS.COMPLETED && t.STATUS !== config.TASK_STATUS.XP_CREDITED);
  const endingSoon = allTasks.filter(t => {
    if (!t.SUBMISSION_DEADLINE) return false;
    const diff = new Date(t.SUBMISSION_DEADLINE).getTime() - nowTime;
    return diff > 0 && diff <= 24 * 3600 * 1000;
  });
  const overdueTasks = allTasks.filter(t => {
    if (!t.SUBMISSION_DEADLINE) return false;
    const isDone = [config.TASK_STATUS.COMPLETED, config.TASK_STATUS.XP_CREDITED, config.TASK_STATUS.ARCHIVED].includes(t.STATUS);
    return !isDone && new Date(t.SUBMISSION_DEADLINE).getTime() < nowTime;
  });

  const taskMap = {};
  for (const t of allTasks) {
    taskMap[t.TASK_ID] = t;
  }

  // Lấy rank hiện tại từ leaderboard
  let rank = 1;
  try {
    const lb = await leaderboard.buildLeaderboard();
    const myEntry = lb.all.find(e => String(e.userId) === String(userId));
    if (myEntry) rank = myEntry.rank;
  } catch (e) {}

  // Submissions cần review
  const allSubmissions = await submissions.listSubmissions({});
  const pendingReviews = allSubmissions.filter(s => s.STATUS === config.SUBMISSION_STATUS.HUMAN_REVIEW);
  const aiAlerts = allSubmissions.filter(s => s.STATUS === config.SUBMISSION_STATUS.NEEDS_REVISION || s.STATUS === config.SUBMISSION_STATUS.SUSPICIOUS);

  // Department Stats
  const users = await auth.listUsers({});
  let deptXp = 0;
  for (const u of users) {
    if (u.DEPARTMENT === userDept) {
      const ub = await xp.computeBreakdown(u.USER_ID);
      deptXp += (ub.overall || 0);
    }
  }

  const myActiveRelations = [...myClaims, ...myAssignments].map((r) => ({
    relationId: r.CLAIM_ID || r.ASSIGNMENT_ID,
    kind: r.CLAIM_ID ? 'CLAIM' : 'ASSIGNMENT',
    status: r.STATUS,
    task: taskMap[r.TASK_ID] || null
  })).filter(r => r.task);

  return {
    user: user ? auth.sanitizeUser(user) : null,
    breakdown,
    rank,
    recentTxns,
    myTasks: myActiveRelations,
    memberMetrics: {
      currentXp: breakdown.overall,
      overallRank: rank,
      myActiveTasks: myActiveRelations.filter(r => [config.CLAIM_STATUS.ACTIVE, config.CLAIM_STATUS.IN_PROGRESS, config.CLAIM_STATUS.CLAIMED].includes(r.status)).length,
      availableMissions: openTasks.length,
      endingSoon: endingSoon.length,
      currentStreak: 6,
      completedTasks: breakdown.completedTasks || 0,
      qualityScore: breakdown.qualityScore || 95
    },
    coreMetrics: {
      teamCompletionRate: allTasks.length ? Math.round((allTasks.filter(t => t.STATUS === config.TASK_STATUS.COMPLETED || t.STATUS === config.TASK_STATUS.XP_CREDITED).length / allTasks.length) * 100) : 100,
      activeTasks: allTasks.filter(t => [config.TASK_STATUS.OPEN, config.TASK_STATUS.IN_PROGRESS, config.TASK_STATUS.CLAIMED].includes(t.STATUS)).length,
      pendingReviews: pendingReviews.length,
      overdueTasks: overdueTasks.length,
      mandatoryTasks: mandatoryTasks.length,
      teamXp: round2(deptXp),
      membersNeedingSupport: overdueTasks.length
    },
    founderOverview: {
      activeMembers: users.filter(u => u.STATUS !== 'ARCHIVED').length,
      totalTasks: allTasks.length,
      completedTasksCount: allTasks.filter(t => t.STATUS === config.TASK_STATUS.COMPLETED || t.STATUS === config.TASK_STATUS.XP_CREDITED).length,
      pendingReviewsCount: pendingReviews.length,
      aiAlertsCount: aiAlerts.length,
      overdueCount: overdueTasks.length,
      mandatoryCount: mandatoryTasks.length
    },
    summary: {
      openTasks: openTasks.length,
      inProgress: myClaims.filter(c => c.STATUS === config.CLAIM_STATUS.ACTIVE || c.STATUS === config.CLAIM_STATUS.IN_PROGRESS).length,
      submitted: myClaims.filter(c => c.STATUS === config.CLAIM_STATUS.SUBMITTED).length
    }
  };
}

// Xảy ra xử lý AI verify bằng Gemini nếu có
async function aiVerifySubmission(submissionId, env = {}) {
  const sub = await store.store().get('TASK_SUBMISSIONS', 'SUBMISSION_ID', String(submissionId));
  if (!sub) throw new Error('Submission không tồn tại.');
  const task = await tasks.getTask(sub.TASK_ID);
  const result = await ai.verifyProof({ task, submission: sub, claim: {}, gemini: geminiFactory() });
  return submissions.aiCheck(submissionId, result.verdict, result.report, 'AI');
}

module.exports = {
  config, store, schema: SCHEMA, audit, xp, auth, tasks, claims, assignments,
  submissions, ai, roleReview, bonus, leaderboard, season, production,
  notifications, templates, drive: null,
  bootstrap, getDashboard, aiVerifySubmission, geminiFactory,
};