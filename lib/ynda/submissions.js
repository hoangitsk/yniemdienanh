'use strict';

// =============================================================================
// YNDA SUBMISSION / PROOF ENGINE
// -----------------------------------------------------------------------------
// Member submit proof; mỗi bản submit là một VERSION (v1, v2, v3...).
// KHÔNG xóa submission cũ. Chỉ bản Approved mới được tính điểm.
//
// Flow: SUBMITTED → AI CHECK → HUMAN REVIEW → APPROVED → XP CREDITED
// Lỗi:  SUBMITTED → AI CHECK → NEEDS REVISION → RESUBMIT (v2)
//
// AI chỉ VERIFY (XXI): proof tồn tại? đúng task? đúng nền tảng? đúng hành
// động? đủ số lượng? trùng proof? bất thường? đúng format?
// Output: PASS / NEEDS REVISION / SUSPICIOUS / INVALID
//
// Human Review (XXII): APPROVE / RETURN / REJECT. XP chỉ được tạo khi Human
// Review APPROVED. AI KHÔNG được tự cộng XP.
// =============================================================================

const { store, uid } = require('./store');
const { SCHEMA } = require('./schema');
const config = require('./config');
const { nowIso, round2, toNumber, parseJson } = require('./utils');
const tasks = require('./tasks');
const claims = require('./claims');
const assignments = require('./assignments');
const xp = require('./xp');
const audit = require('./audit');

const TAB = 'TASK_SUBMISSIONS';
const REVIEW_TAB = 'TASK_REVIEWS';

async function ensureTables() {
  const s = store();
  await s.ensureTable(TAB, SCHEMA.TASK_SUBMISSIONS);
  await s.ensureTable(REVIEW_TAB, SCHEMA.TASK_REVIEWS);
}

async function latestSubmission(taskId, userId) {
  const rows = await store().query(TAB, r =>
    String(r.TASK_ID || '') === String(taskId) && String(r.USER_ID || '') === String(userId));
  rows.sort((a, b) => versionNum(b.VERSION) - versionNum(a.VERSION));
  return rows[0] || null;
}

async function listSubmissions(filter = {}) {
  let rows = await store().list(TAB);
  if (filter.taskId) rows = rows.filter(r => String(r.TASK_ID || '') === String(filter.taskId));
  if (filter.userId) rows = rows.filter(r => String(r.USER_ID || '') === String(filter.userId));
  if (filter.status) rows = rows.filter(r => String(r.STATUS || '') === String(filter.status));
  return rows.sort((a, b) => String(a.CREATED_AT).localeCompare(String(b.CREATED_AT)));
}

function versionNum(v) {
  const m = String(v || '').match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

// -----------------------------------------------------------------------------
// SUBMIT — đẩy proof mới. Nếu là lần đầu thì v1; nếu re-submit sau NEEDS
// REVISION thì tăng version. Submission cũ GIỮ NGUYÊN.
// =============================================================================
async function submit({ taskRef, userId, proof, proofFiles, claimId, assignmentId }) {
  await ensureTables();
  const task = await tasks.getTask(taskRef);
  if (!task) throw new Error('Task không tồn tại.');

  // Phải có claim hoặc assignment hợp lệ
  let claim = null;
  if (claimId) {
    claim = await store().get('TASK_CLAIMS', 'CLAIM_ID', String(claimId));
    if (!claim || String(claim.USER_ID) !== String(userId)) throw new Error('Claim không hợp lệ.');
  }
  let assignment = null;
  if (assignmentId) {
    assignment = await store().get('TASK_ASSIGNMENTS', 'ASSIGNMENT_ID', String(assignmentId));
    if (!assignment || String(assignment.ASSIGNEE) !== String(userId)) throw new Error('Assignment không hợp lệ.');
  }
  if (!claim && !assignment) {
    // Tự dò claim đang hoạt động của user cho task này
    const active = await claims.activeClaim(task.TASK_ID, userId);
    if (active) claim = active;
  }
  if (!claim && !assignment) throw new Error('Bạn phải Claim hoặc được giao task trước khi submit.');

  const prev = await latestSubmission(task.TASK_ID, userId);
  const version = prev ? `v${versionNum(prev.VERSION) + 1}` : 'v1';

  const subId = uid('SUB');
  const record = {
    SUBMISSION_ID: subId,
    TASK_ID: task.TASK_ID,
    CLAIM_ID: claim ? claim.CLAIM_ID : '',
    ASSIGNMENT_ID: assignment ? assignment.ASSIGNMENT_ID : '',
    USER_ID: userId,
    VERSION: version,
    PROOF: proof || '',
    PROOF_FILES: Array.isArray(proofFiles) ? JSON.stringify(proofFiles) : '',
    DRIVE_PATH: '',
    STATUS: config.SUBMISSION_STATUS.SUBMITTED,
    AI_VERDICT: '',
    AI_REPORT: '',
    SUBMITTED_AT: nowIso(),
    REVIEWED_AT: '',
    REVIEWER: '',
    HUMAN_VERDICT: '',
    HUMAN_REASON: '',
    BASE_XP: round2(toNumber(task.XP_FINAL)),
    QUALITY_BONUS_XP: '',
    PENALTY_XP: '',
    FINAL_XP: '',
    CREATED_AT: nowIso()
  };
  await store().insert(TAB, record);

  // Cập nhật claim / assignment sang SUBMITTED
  if (claim) await store().update('TASK_CLAIMS', 'CLAIM_ID', claim.CLAIM_ID, { STATUS: config.CLAIM_STATUS.SUBMITTED, SUBMITTED_AT: nowIso(), UPDATED_AT: nowIso() });
  if (assignment) await store().update('TASK_ASSIGNMENTS', 'ASSIGNMENT_ID', assignment.ASSIGNMENT_ID, { STATUS: config.ASSIGNMENT_STATUS.SUBMITTED, SUBMITTED_AT: nowIso(), UPDATED_AT: nowIso() });
  await tasks.updateTask(task.TASK_ID, { STATUS: config.TASK_STATUS.SUBMITTED });

  await audit.log({ actor: userId, action: 'SUBMISSION', entityType: 'TASK_SUBMISSIONS', entityId: subId, after: { version, taskCode: task.CODE } });

  return record;
}

// -----------------------------------------------------------------------------
// AI CHECK (XXI) — AI verify, output verdict. AI không cộng điểm.
// =============================================================================
async function aiCheck(submissionId, verdict, report, engine) {
  await ensureTables();
  const sub = await store().get(TAB, 'SUBMISSION_ID', String(submissionId));
  if (!sub) throw new Error('Submission không tồn tại.');

  const v = String(verdict || '').toUpperCase();
  if (!config.AI_VERDICTS.includes(v)) {
    throw new Error(`AI verdict phải là một trong: ${config.AI_VERDICTS.join(', ')}.`);
  }

  const status = v === 'PASS'
    ? config.SUBMISSION_STATUS.HUMAN_REVIEW
    : v === 'INVALID' ? config.SUBMISSION_STATUS.INVALID : config.SUBMISSION_STATUS.NEEDS_REVISION;

  const updated = await store().update(TAB, 'SUBMISSION_ID', String(submissionId), {
    STATUS: status,
    AI_VERDICT: v,
    AI_REPORT: typeof report === 'string' ? report : JSON.stringify(report || {}),
    REVIEWED_AT: nowIso()
  });

  await store().insert(REVIEW_TAB, {
    REVIEW_ID: uid('REV'),
    TASK_ID: sub.TASK_ID,
    SUBMISSION_ID: submissionId,
    REVIEWER: engine || 'AI',
    REVIEW_TYPE: 'AI',
    VERDICT: v,
    REASON: typeof report === 'string' ? report : '',
    REPORT: typeof report === 'string' ? '' : JSON.stringify(report || {}),
    CREATED_AT: nowIso()
  });
  return updated;
}

// -----------------------------------------------------------------------------
// HUMAN REVIEW (XXII) — APPROVE / RETURN / REJECT
// Chỉ APPROVED mới tạo XP.
// =============================================================================
async function humanReview(submissionId, reviewer, verdict, reason, qualityBonusXp, opts = {}) {
  await ensureTables();
  const sub = await store().get(TAB, 'SUBMISSION_ID', String(submissionId));
  if (!sub) throw new Error('Submission không tồn tại.');

  const v = String(verdict || '').toUpperCase();
  if (!config.HUMAN_REVIEW_ACTIONS.includes(v)) {
    throw new Error(`Human review phải là một trong: ${config.HUMAN_REVIEW_ACTIONS.join(', ')}.`);
  }

  const task = await tasks.getTask(sub.TASK_ID);

  // XP policy từ claim/assignment
  let policy = config.XP_POLICY.FULL;
  let forced = false;
  if (sub.CLAIM_ID) {
    const c = await store().get('TASK_CLAIMS', 'CLAIM_ID', sub.CLAIM_ID);
    if (c) policy = c.XP_POLICY || config.XP_POLICY.FULL;
  }
  if (sub.ASSIGNMENT_ID) {
    const a = await store().get('TASK_ASSIGNMENTS', 'ASSIGNMENT_ID', sub.ASSIGNMENT_ID);
    if (a) {
      policy = a.XP_POLICY || config.XP_POLICY.FULL;
      forced = a.ASSIGNMENT_TYPE === config.ASSIGNMENT_TYPE.MANDATORY_ESCALATION || a.ASSIGNMENT_TYPE === config.ASSIGNMENT_TYPE.DIRECT;
    }
  }

  const baseXp = round2(toNumber(task && task.XP_FINAL) || toNumber(sub.BASE_XP));
  let finalXp = 0;

  if (v === 'APPROVE') {
    let xpVal = baseXp;

    if (policy === config.XP_POLICY.FORCED_50) {
      // Forced: 50% Base XP + Quality Bonus tối đa 50%
      const base = round2(baseXp * 0.5);
      const qb = round2(toNumber(qualityBonusXp));
      const maxBonus = round2(baseXp * 0.5);
      finalXp = round2(base + Math.max(0, Math.min(maxBonus, qb)));
    } else {
      finalXp = round2(xpVal);
    }

    // Penalty (XIII)
    const penalty = xp.computePenalty({
      taskXp: baseXp,
      workStart: task.WORK_START,
      submissionDeadline: task.SUBMISSION_DEADLINE,
      atIso: sub.SUBMITTED_AT || nowIso()
    });
    const penaltyApplied = penalty < 0 ? penalty : 0;

    // Ghi XP ledger — chỉ khi Human Review APPROVED
    const seasonId = task.SEASON_ID || opts.seasonId || '';
    const txnTask = await xp.recordTxn({
      user: sub.USER_ID,
      type: task && task.SCOPE === 'MANDATORY' ? config.XP_TYPES.TASK : config.XP_TYPES.TASK,
      sourceId: task.TASK_ID,
      sourceName: `${task.CODE} — ${task.TITLE}`,
      rawPoint: finalXp,
      reviewer: reviewer,
      notes: `Task ${task.CODE} approved. Policy=${policy}`,
      createdBy: reviewer,
      seasonId
    });

    let txnPenalty = null;
    if (penaltyApplied !== 0) {
      txnPenalty = await xp.recordTxn({
        user: sub.USER_ID,
        type: config.XP_TYPES.PENALTY,
        sourceId: task.TASK_ID,
        sourceName: `${task.CODE} — penalty`,
        rawPoint: penaltyApplied,
        reviewer: reviewer,
        notes: `Penalty — task ${task.CODE} — progress penalty`,
        createdBy: reviewer,
        seasonId
      });
    }

    const status = config.SUBMISSION_STATUS.APPROVED;
    const updated = await store().update(TAB, 'SUBMISSION_ID', String(submissionId), {
      STATUS: status,
      HUMAN_VERDICT: 'APPROVED',
      HUMAN_REASON: reason || '',
      REVIEWER: reviewer,
      REVIEWED_AT: nowIso(),
      BASE_XP: baseXp,
      QUALITY_BONUS_XP: policy === config.XP_POLICY.FORCED_50 ? round2(finalXp - round2(baseXp * 0.5)) : '',
      PENALTY_XP: penaltyApplied !== 0 ? String(penaltyApplied) : '',
      FINAL_XP: finalXp
    });

    // Cập nhật claim/assignment
    if (sub.CLAIM_ID) await store().update('TASK_CLAIMS', 'CLAIM_ID', sub.CLAIM_ID, { STATUS: config.CLAIM_STATUS.COMPLETED, UPDATED_AT: nowIso() });
    if (sub.ASSIGNMENT_ID) await store().update('TASK_ASSIGNMENTS', 'ASSIGNMENT_ID', sub.ASSIGNMENT_ID, { STATUS: config.ASSIGNMENT_STATUS.COMPLETED, UPDATED_AT: nowIso() });

    await store().insert(REVIEW_TAB, {
      REVIEW_ID: uid('REV'), TASK_ID: sub.TASK_ID, SUBMISSION_ID: submissionId,
      REVIEWER: reviewer, REVIEW_TYPE: 'HUMAN', VERDICT: 'APPROVE',
      REASON: reason || '', REPORT: JSON.stringify({ finalXp, penaltyApplied, policy }),
      CREATED_AT: nowIso()
    });

    await tasks.updateTask(sub.TASK_ID, { STATUS: config.TASK_STATUS.XP_CREDITED });
    await audit.log({ actor: reviewer, action: 'APPROVE', entityType: 'TASK_SUBMISSIONS', entityId: submissionId, after: { finalXp, txnTask: txnTask.TRANSACTION_ID, txnPenalty: txnPenalty ? txnPenalty.TRANSACTION_ID : null } });

    return { ...updated, XP_TXN: txnTask, PENALTY_TXN: txnPenalty };
  }

  if (v === 'RETURN') {
    const updated = await store().update(TAB, 'SUBMISSION_ID', String(submissionId), {
      STATUS: config.SUBMISSION_STATUS.NEEDS_REVISION,
      HUMAN_VERDICT: 'RETURN',
      HUMAN_REASON: reason || '',
      REVIEWER: reviewer,
      REVIEWED_AT: nowIso()
    });
    await tasks.updateTask(sub.TASK_ID, { STATUS: config.TASK_STATUS.NEEDS_REVISION });
    await store().insert(REVIEW_TAB, {
      REVIEW_ID: uid('REV'), TASK_ID: sub.TASK_ID, SUBMISSION_ID: submissionId,
      REVIEWER: reviewer, REVIEW_TYPE: 'HUMAN', VERDICT: 'RETURN',
      REASON: reason || '', REPORT: '', CREATED_AT: nowIso()
    });
    await audit.log({ actor: reviewer, action: 'REJECT', entityType: 'TASK_SUBMISSIONS', entityId: submissionId, after: { verdict: 'RETURN', reason } });
    return updated;
  }

  // REJECT
  const updated = await store().update(TAB, 'SUBMISSION_ID', String(submissionId), {
    STATUS: config.SUBMISSION_STATUS.REJECTED,
    HUMAN_VERDICT: 'REJECT',
    HUMAN_REASON: reason || '',
    REVIEWER: reviewer,
    REVIEWED_AT: nowIso(),
    FINAL_XP: 0
  });
  if (sub.CLAIM_ID) await store().update('TASK_CLAIMS', 'CLAIM_ID', sub.CLAIM_ID, { STATUS: config.CLAIM_STATUS.RELEASED, UPDATED_AT: nowIso() });
  await store().insert(REVIEW_TAB, {
    REVIEW_ID: uid('REV'), TASK_ID: sub.TASK_ID, SUBMISSION_ID: submissionId,
    REVIEWER: reviewer, REVIEW_TYPE: 'HUMAN', VERDICT: 'REJECT',
    REASON: reason || '', REPORT: '', CREATED_AT: nowIso()
  });
  await audit.log({ actor: reviewer, action: 'REJECT', entityType: 'TASK_SUBMISSIONS', entityId: submissionId, after: { verdict: 'REJECT', reason } });
  return updated;
}

module.exports = { TAB, submit, aiCheck, humanReview, listSubmissions, latestSubmission, ensureTables };