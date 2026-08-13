'use strict';

// =============================================================================
// YNDA SERVICE — facade điều phối toàn bộ engines
// =============================================================================

const config = require('./config');
const store = require('./store');
const schema = require('./schema');
const audit = require('./audit');
const xp = require('./xp');
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

// ------------------------------------------------ đọc dữ liệu quan hệ
async function getDashboard(userId) {
  const user = await store.store().get('USERS', 'USER_ID', String(userId));
  const breakdown = await xp.computeBreakdown(userId);
  const myClaims = await claims.listClaims({ userId });
  const myAssignments = await assignments.listAssignments({ assignee: userId });

  const taskIds = new Set();
  myClaims.forEach(c => taskIds.add(c.TASK_ID));
  myAssignments.forEach(a => taskIds.add(a.TASK_ID));
  const taskMap = {};
  for (const tid of taskIds) {
    const t = await tasks.getTask(tid);
    if (t) taskMap[tid] = t;
  }

  return {
    user: user ? require('./auth').sanitizeUser(user) : null,
    breakdown,
    myTasks: [...myClaims, ...myAssignments].map((r) => ({
      relationId: r.CLAIM_ID || r.ASSIGNMENT_ID,
      kind: r.CLAIM_ID ? 'CLAIM' : 'ASSIGNMENT',
      status: r.STATUS,
      task: taskMap[r.TASK_ID] || null
    })).filter(r => r.task),
    summary: {
      openTasks: (await tasks.listTasks({ status: config.TASK_STATUS.OPEN })).length,
      inProgress: myClaims.filter(c => c.STATUS === config.CLAIM_STATUS.ACTIVE).length,
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
  config, store, schema: SCHEMA, audit, xp, tasks, claims, assignments,
  submissions, ai, roleReview, bonus, leaderboard, season, production,
  notifications, templates, drive: null,
  bootstrap, getDashboard, aiVerifySubmission, geminiFactory,
};