'use strict';

// =============================================================================
// YNDA ASSIGNMENT ENGINE (VIII)
// -----------------------------------------------------------------------------
// ⚠️ “Giao nhiệm vụ” LÀ CƠ CHẾ RIÊNG, KHÔNG đồng nhất với Claim,
// Mandatory Task hay Mission Type.
//
//   Claim         ≠ Assignment
//   Mandatory     ≠ Assignment
//   Task Type     ≠ Assignment
//
// Một Task có thể: tự nguyện Claim / được giao trực tiếp / chuyển sang bắt
// buộc theo cơ chế Mandatory. Assignment có dữ liệu riêng trong
// TASK_ASSIGNMENTS. Lịch sử giao nhiệm vụ không được xóa (audit trail).
// =============================================================================

const { store, uid } = require('./store');
const { SCHEMA } = require('./schema');
const config = require('./config');
const { nowIso, toNumber, parseJson } = require('./utils');
const tasks = require('./tasks');
const audit = require('./audit');

const TAB = 'TASK_ASSIGNMENTS';

async function ensureTables() {
  const s = store();
  await s.ensureTable(TAB, SCHEMA.TASK_ASSIGNMENTS);
}

async function getAssignment(assignmentId) {
  return store().get(TAB, 'ASSIGNMENT_ID', String(assignmentId));
}

async function listAssignments(filter = {}) {
  let rows = await store().list(TAB);
  if (filter.taskId) rows = rows.filter(r => String(r.TASK_ID || '') === String(filter.taskId));
  if (filter.assignee) rows = rows.filter(r => String(r.ASSIGNEE || '') === String(filter.assignee));
  if (filter.assigner) rows = rows.filter(r => String(r.ASSIGNER || '') === String(filter.assigner));
  if (filter.status) rows = rows.filter(r => String(r.STATUS || '') === String(filter.status));
  return rows;
}

// -----------------------------------------------------------------------------
// ASSIGN — Core/BĐH giao task trực tiếp cho member
// -----------------------------------------------------------------------------
// - assignmentType: DIRECT | MANDATORY_ESCALATION | VOLUNTARY
// - dueTime: mốc cần hoàn thành (nếu có, khác deadline task)
// - stated by: assigner, reason, note
async function assign(taskRef, assigneeId, assigner, input = {}) {
  await ensureTables();
  const task = await tasks.getTask(taskRef);
  if (!task) throw new Error('Task không tồn tại.');

  const assignmentId = uid('ASG');
  const assignmentType = input.assignmentType || config.ASSIGNMENT_TYPE.DIRECT;

  // MANDATORY escalation: nếu task MANDATORY không có người nhận -> ép giao với
  // XP_POLICY = FORCED_50 (50% Base XP + Quality Bonus tối đa 50%).
  const isForced = assignmentType === config.ASSIGNMENT_TYPE.MANDATORY_ESCALATION
    || task.SCOPE === config.TASK_TYPES.MANDATORY;

  const policy = isForced ? config.XP_POLICY.FORCED_50 : config.XP_POLICY.FULL;

  const record = {
    ASSIGNMENT_ID: assignmentId,
    TASK_ID: task.TASK_ID,
    ASSIGNER: assigner ? assigner.USER_ID || assigner.email : '',
    ASSIGNEE: assigneeId,
    ASSIGNED_AT: nowIso(),
    DUE_TIME: input.dueTime || task.SUBMISSION_DEADLINE || '',
    ASSIGNMENT_TYPE: assignmentType,
    REASON: input.reason || '',
    STATUS: config.ASSIGNMENT_STATUS.ASSIGNED,
    NOTE: input.note || '',
    XP_POLICY: policy,
    ACCEPTED_AT: '',
    STARTED_AT: '',
    SUBMITTED_AT: '',
    CREATED_AT: nowIso(),
    UPDATED_AT: nowIso()
  };
  await store().insert(TAB, record);

  await audit.log({
    actor: record.ASSIGNER,
    action: 'ASSIGNMENT',
    entityType: 'TASK',
    entityId: task.TASK_ID,
    after: { assignmentId, assignee: assigneeId, type: assignmentType, policy }
  });

  // Chuyển task sang ASSIGNED
  if (task.STATUS === config.TASK_STATUS.OPEN || task.STATUS === config.TASK_STATUS.SCHEDULED || task.STATUS === config.TASK_STATUS.APPROVED) {
    await tasks.updateTask(task.TASK_ID, { STATUS: config.TASK_STATUS.ASSIGNED });
  }
  return record;
}

// ACCEPT / REJECT / START — member phản hồi assignment (VIII)
async function respond(assignmentId, userId, action) {
  const s = store();
  const a = await getAssignment(assignmentId);
  if (!a) throw new Error('Assignment không tồn tại.');
  if (String(a.ASSIGNEE || '') !== String(userId)) throw new Error('Assignment không thuộc bạn.');

  if (action === 'ACCEPT') {
    if (a.STATUS !== config.ASSIGNMENT_STATUS.ASSIGNED) throw new Error('Assignment không ở trạng thái ASSIGNED.');
    return s.update(TAB, 'ASSIGNMENT_ID', assignmentId, { STATUS: config.ASSIGNMENT_STATUS.ACCEPTED, ACCEPTED_AT: nowIso(), UPDATED_AT: nowIso() });
  }
  if (action === 'REJECT') {
    if (a.STATUS !== config.ASSIGNMENT_STATUS.ASSIGNED) throw new Error('Assignment không ở trạng thái ASSIGNED.');
    return s.update(TAB, 'ASSIGNMENT_ID', assignmentId, { STATUS: config.ASSIGNMENT_STATUS.REJECTED, UPDATED_AT: nowIso() });
  }
  if (action === 'START') {
    if (a.STATUS !== config.ASSIGNMENT_STATUS.ACCEPTED && a.STATUS !== config.ASSIGNMENT_STATUS.ASSIGNED) {
      throw new Error('Phải ACCEPT trước khi START.');
    }
    return s.update(TAB, 'ASSIGNMENT_ID', assignmentId, { STATUS: config.ASSIGNMENT_STATUS.STARTED, STARTED_AT: nowIso(), ACCEPTED_AT: a.ACCEPTED_AT || nowIso(), UPDATED_AT: nowIso() });
  }
  throw new Error('Action không hợp lệ.');
}

// -----------------------------------------------------------------------------
// MANDATORY ESCALATION (VII.C)
// Task bắt buộc: mở claim tự nguyện trong thời gian quy định; nếu không ai
// nhận -> auto-escalate sang cơ chế bắt buộc (ép giao). Người tự nhận tối đa
// 100% XP; người bị ép giao 50% base + quality bonus tối đa 50%.
// =============================================================================
async function checkMandatoryEscalation(taskRef) {
  const task = await tasks.getTask(taskRef);
  if (!task) return { code: null, status: 'no-task' };
  if (String(task.SCOPE || '').toUpperCase() !== config.TASK_TYPES.MANDATORY) return { code: task.CODE, status: 'not-mandatory' };
  if (task.STATUS !== config.TASK_STATUS.OPEN) return { code: task.CODE, status: task.STATUS };

  const claims = await store().list('TASK_CLAIMS');
  const hasClaimed = claims.some(c =>
    String(c.TASK_ID || '') === String(task.TASK_ID) &&
    ![config.CLAIM_STATUS.RELEASED].includes(c.STATUS)
  );
  if (hasClaimed) return { code: task.CODE, status: 'claimed' };

  // Hết claim deadline (tự nguyện) mà chưa có ai -> auto-escalate
  const due = new Date(task.CLAIM_DEADLINE || 0);
  if (due.getTime() <= Date.now()) {
    const msg = `Task MANDATORY ${task.CODE} không có người nhận trong thời gian quy định. Auto-escalate sang giao bắt buộc.`;
    await tasks.updateTask(task.TASK_ID, { FORCED: 'TRUE' });
    await audit.log({ actor: 'system', action: 'TASK', entityType: 'TASK', entityId: task.TASK_ID, after: { forced: true } });
    return { code: task.CODE, status: 'escalated', message: msg };
  }
  return { code: task.CODE, status: 'waiting-claimants' };
}

module.exports = { TAB, assign, respond, getAssignment, listAssignments, checkMandatoryEscalation, ensureTables };