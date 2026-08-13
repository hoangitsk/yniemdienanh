'use strict';

// =============================================================================
// YNDA CLAIM ENGINE
// -----------------------------------------------------------------------------
// Claim là cơ chế tự nguyện nhận Task. Claim ≠ Start (XIV): claim không bắt
// đầu tính penalty; penalty chỉ bắt đầu từ Work Start.
// =============================================================================

const { store, uid } = require('./store');
const { SCHEMA } = require('./schema');
const config = require('./config');
const { nowIso, toNumber, isOverdue } = require('./utils');
const tasks = require('./tasks');
const audit = require('./audit');

const TAB = 'TASK_CLAIMS';

async function ensureTables() {
  const s = store();
  await s.ensureTable(TAB, SCHEMA.TASK_CLAIMS);
}

async function hasClaim(taskId, userId, statuses) {
  const rows = await store().query(TAB, r => {
    if (String(r.TASK_ID || '') !== String(taskId)) return false;
    if (String(r.USER_ID || '') !== String(userId)) return false;
    if (statuses && statuses.length && !statuses.includes(r.STATUS)) return false;
    return true;
  });
  return rows[0] || null;
}

async function activeClaim(taskId, userId) {
  return hasClaim(taskId, userId, [
    config.CLAIM_STATUS.CLAIMED,
    config.CLAIM_STATUS.ACTIVE,
    config.CLAIM_STATUS.IN_PROGRESS,
    config.CLAIM_STATUS.SUBMITTED
  ]);
}

// Đếm số người đang giữ claim của task (để check slot)
async function countActiveClaims(taskId) {
  const rows = await store().list(TAB);
  return rows.filter(r =>
    String(r.TASK_ID || '') === String(taskId) &&
    ![config.CLAIM_STATUS.RELEASED, config.CLAIM_STATUS.ABANDONED, config.CLAIM_STATUS.COMPLETED].includes(r.STATUS)
  ).length;
}

// -----------------------------------------------------------------------------
// CLAIM — member mở Task → claim → start
// =============================================================================
async function claim(taskRef, user, actor) {
  await ensureTables();
  const task = await tasks.getTask(taskRef);
  if (!task) throw new Error('Task không tồn tại.');

  // Chỉ task OPEN mới claim được
  if (task.STATUS !== config.TASK_STATUS.OPEN) {
    throw new Error(`Task ${task.CODE} không ở trạng thái OPEN (hiện tại: ${task.STATUS}).`);
  }

  // Quá claim deadline không nhận được
  if (isOverdue(task.CLAIM_DEADLINE)) {
    throw new Error(`Đã quá hạn claim của task ${task.CODE}.`);
  }

  // DEPARTMENT OPEN: chỉ member thuộc Ban (VII.B)
  if (task.SCOPE === config.TASK_TYPES.DEPARTMENT_OPEN && task.DEPARTMENT !== 'GLOBAL') {
    const dept = String(user.DEPARTMENT || '');
    if (dept !== task.DEPARTMENT) {
      throw new Error(`Task ${task.CODE} thuộc ban ${task.DEPARTMENT}; bạn thuộc ban ${dept || '(chưa có)'}.`);
    }
  }

  // Slot giới hạn
  if (task.UNLIMITED_SLOTS !== 'TRUE') {
    const slots = toNumber(task.SLOTS) || 0;
    const active = await countActiveClaims(task.TASK_ID);
    if (slots > 0 && active >= slots) {
      throw new Error(`Task ${task.CODE} đã hết slot (${slots}).`);
    }
  }

  // Không claim 2 lần
  const existing = await activeClaim(task.TASK_ID, user.USER_ID);
  if (existing) throw new Error('Bạn đã claim task này rồi.');

  const claimId = uid('CLM');
  const record = {
    CLAIM_ID: claimId,
    TASK_ID: task.TASK_ID,
    USER_ID: user.USER_ID,
    STATUS: config.CLAIM_STATUS.CLAIMED,
    CLAIMED_AT: nowIso(),
    STARTED_AT: '',
    SUBMITTED_AT: '',
    SLOT: '',
    XP_POLICY: config.XP_POLICY.FULL,
    CREATED_AT: nowIso(),
    UPDATED_AT: nowIso()
  };
  await store().insert(TAB, record);

  await audit.log({
    actor: actor || user.USER_ID,
    action: 'CLAIM',
    entityType: 'TASK',
    entityId: task.TASK_ID,
    after: { claimId, code: task.CODE, user: user.USER_ID }
  });

  // Task chuyển trạng thái
  if (task.STATUS === config.TASK_STATUS.OPEN) {
    await tasks.updateTask(task.TASK_ID, { STATUS: config.TASK_STATUS.CLAIMED });
  }
  return record;
}

// START — bắt đầu làm việc (Claim ≠ Start)
async function start(claimId, user) {
  await ensureTables();
  const s = store();
  const claimRow = await s.get(TAB, 'CLAIM_ID', String(claimId));
  if (!claimRow || String(claimRow.USER_ID) !== String(user.USER_ID)) {
    throw new Error('Claim không tồn tại hoặc không thuộc bạn.');
  }
  if (claimRow.STATUS === config.CLAIM_STATUS.SUBMITTED) {
    throw new Error('Claim đã submit.');
  }
  const updated = await s.update(TAB, 'CLAIM_ID', String(claimId), {
    STATUS: config.CLAIM_STATUS.ACTIVE,
    STARTED_AT: nowIso(),
    UPDATED_AT: nowIso()
  });
  await audit.log({ actor: user.USER_ID, action: 'START_TASK', entityType: 'CLAIM', entityId: claimId, after: updated });
  return updated;
}

// RELEASE — trả lại task (không bị penalty nếu trước Work Start)
async function release(claimId, user) {
  const s = store();
  const claimRow = await s.get(TAB, 'CLAIM_ID', String(claimId));
  if (!claimRow || String(claimRow.USER_ID) !== String(user.USER_ID)) throw new Error('Claim không thuộc bạn.');
  if (claimRow.STATUS === config.CLAIM_STATUS.SUBMITTED) throw new Error('Không thể release sau khi submit.');
  const updated = await s.update(TAB, 'CLAIM_ID', String(claimId), {
    STATUS: config.CLAIM_STATUS.RELEASED, UPDATED_AT: nowIso()
  });
  await audit.log({ actor: user.USER_ID, action: 'CLAIM', entityType: 'CLAIM', entityId: claimId, after: { status: 'RELEASED' } });
  return updated;
}

async function listClaims(filter = {}) {
  let rows = await store().list(TAB);
  if (filter.userId) rows = rows.filter(r => String(r.USER_ID || '') === String(filter.userId));
  if (filter.taskId) rows = rows.filter(r => String(r.TASK_ID || '') === String(filter.taskId));
  if (filter.status) rows = rows.filter(r => String(r.STATUS || '') === String(filter.status));
  return rows;
}

module.exports = { TAB, claim, start, release, listClaims, activeClaim, countActiveClaims, ensureTables };