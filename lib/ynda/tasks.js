'use strict';

// =============================================================================
// YNDA TASK ENGINE
// -----------------------------------------------------------------------------
// Quản lý vòng đời Task: DRAFT → AI_ANALYSIS → APPROVED → SCHEDULED → OPEN
// → CLAIMED/ASSIGNED/ACTIVE → IN PROGRESS → SUBMITTED → AI CHECK →
// HUMAN REVIEW → APPROVED → XP CREDITED. Nếu lỗi: NEEDS REVISION → RESUBMIT.
//
// Ba loại task (VII): GLOBAL OPEN, DEPARTMENT OPEN, MANDATORY.
// XP Scale chuẩn (XXIX): M0..M7. AI đề xuất XP, creator được sửa kèm reason
// (XXIII). Không kế thừa thang điểm cũ.
// =============================================================================

const { store, uid } = require('./store');
const { SCHEMA } = require('./schema');
const config = require('./config');
const { nowIso, round2, toNumber, parseJson, taskCode } = require('./utils');
const xp = require('./xp');

const TAB = 'TASKS';
const COUNTER_TAB = 'COUNTERS';

async function ensureTables() {
  const s = store();
  await s.ensureTable(TAB, SCHEMA.TASKS);
  await s.ensureTable('COUNTERS', ['KEY', 'VALUE']);
}

async function nextTaskCounter(department) {
  const s = store();
  await ensureTables();
  const key = `TASK_${department || 'GLOBAL'}`;
  const rows = await s.list('COUNTERS');
  const row = rows.find(r => String(r.KEY || '') === key);
  const next = (row ? toNumber(row.VALUE) : 0) + 1;
  if (row) {
    await s.update('COUNTERS', 'KEY', key, { VALUE: next });
  } else {
    await s.insert('COUNTERS', { KEY: key, VALUE: next });
  }
  return next;
}

function normalizeTaskType(scope) {
  const sc = String(scope || '').toUpperCase();
  if (sc === config.TASK_TYPES.MANDATORY) return config.TASK_TYPES.MANDATORY;
  return config.TASK_TYPES.GLOBAL_OPEN;
}

// Mặc định 4 mốc deadline (XII). Creator thiết lập riêng.
function defaultDeadlines(days) {
  const d = days || 3;
  const now = new Date();
  const iso = dt => dt.toISOString();
  const open = new Date(now.getTime());
  const claim = new Date(now.getTime() + 3600 * 1000); // +1h
  const work = new Date(now.getTime() + 24 * 3600 * 1000); // +1 ngày
  const submit = new Date(now.getTime() + d * 24 * 3600 * 1000); // +d ngày
  return { openTime: iso(open), claimDeadline: iso(claim), workStart: iso(work), submissionDeadline: iso(submit) };
}

async function createTask(input, actor) {
  await ensureTables();
  const s = store();
  const taskId = uid('TASK');
  const scope = String(input.scope || 'GLOBAL').toUpperCase();
  const department = String(input.department || 'GLOBAL').toUpperCase();
  const prefix = config.DEPARTMENT_PREFIX[department] || config.DEPARTMENT_PREFIX.GLOBAL;
  const counter = await nextTaskCounter(department);
  const code = taskCode(prefix, counter);

  const t = {
    TASK_ID: taskId,
    CODE: code,
    TITLE: input.title || '',
    DESCRIPTION: input.description || '',
    EXPECTED_OUTPUT: input.expectedOutput || '',
    SKILLS: Array.isArray(input.skills) ? input.skills.join(', ') : (input.skills || ''),
    STEPS: Array.isArray(input.steps) ? input.steps.join('\n') : (input.steps || ''),
    SCOPE: scope,
    TASK_TYPE: normalizeTaskType(scope),
    DEPARTMENT: department,
    TEMPLATE_ID: input.templateId || '',
    XP_AI_RECOMMENDED: round2(toNumber(input.xpAiRecommended)),
    XP_FINAL: round2(toNumber(input.xpFinal != null ? input.xpFinal : input.xpAiRecommended)),
    XP_OVERRIDE_REASON: input.xpOverrideReason || '',
    DIFFICULTY: input.difficulty || 'M2',
    DIFFICULTY_REASON: input.difficultyReason || '',
    ESTIMATED_TIME_MIN: toNumber(input.estimatedTimeMin),
    PROOF_REQUIREMENT: input.proofRequirement || '',
    PROOF_FORMAT: input.proofFormat || '',
    AI_VERIFY: String(input.aiVerify ?? 'YES').toUpperCase(),
    REVIEWER_ROLE: input.reviewerRole || '',
    REVIEWER_DEPARTMENT: input.reviewerDepartment || '',
    SLOTS: toNumber(input.slots) || 0,
    UNLIMITED_SLOTS: input.unlimitedSlots ? 'TRUE' : 'FALSE',
    OPEN_TIME: input.openTime || defaultDeadlines().openTime,
    CLAIM_DEADLINE: input.claimDeadline || defaultDeadlines().claimDeadline,
    WORK_START: input.workStart || defaultDeadlines().workStart,
    SUBMISSION_DEADLINE: input.submissionDeadline || defaultDeadlines().submissionDeadline,
    STATUS: config.TASK_STATUS.DRAFT,
    IS_TEAM_TASK: input.isTeamTask ? 'TRUE' : 'FALSE',
    TOTAL_XP: round2(toNumber(input.totalXp)),
    BREAKDOWN: input.breakdown ? JSON.stringify(input.breakdown) : '',
    MANDATORY_ELIGIBLE: input.mandatoryEligible ? 'TRUE' : 'FALSE',
    FORCED: 'FALSE',
    CREATED_BY: actor ? actor.USER_ID || actor.email : '',
    CREATED_AT: nowIso(),
    UPDATED_AT: nowIso(),
    DRIVE_FOLDER_ID: input.driveFolderId || '',
    SEASON_ID: input.seasonId || '',
    ARCHIVED_AT: ''
  };

  await s.insert(TAB, t);
  return t;
}

// Lấy task theo TASK_ID hoặc CODE
async function getTask(ref) {
  await ensureTables();
  const s = store();
  const rows = await s.list(TAB);
  return rows.find(r => String(r.TASK_ID) === String(ref) || String(r.CODE) === String(ref)) || null;
}

async function updateTask(taskId, patch) {
  const s = store();
  const prev = await getTask(taskId);
  if (!prev) return null;
  const updated = await s.update(TAB, 'TASK_ID', String(taskId), { ...patch, UPDATED_AT: nowIso() });
  return updated;
}

async function listTasks(filter = {}) {
  await ensureTables();
  const s = store();
  let rows = await s.list(TAB);
  if (filter.status) rows = rows.filter(r => String(r.STATUS || '') === String(filter.status));
  if (filter.scope) rows = rows.filter(r => String(r.SCOPE || '') === String(filter.scope));
  if (filter.department) rows = rows.filter(r => String(r.DEPARTMENT || '') === String(filter.department));
  if (filter.seasonId) rows = rows.filter(r => String(r.SEASON_ID || '') === String(filter.seasonId));
  if (filter.userId) {
    rows = rows.filter(r => String(r.CREATED_BY || '') === String(filter.userId));
  }
  return rows;
}

// Chuyển trạng thái task với kiểm tra luật
async function transition(task, fromStatuses, toStatus, extra) {
  if (fromStatuses && !fromStatuses.includes(task.STATUS)) {
    throw new Error(`Không thể chuyển task ${task.CODE} từ ${task.STATUS} sang ${toStatus}.`);
  }
  return updateTask(task.TASK_ID, { STATUS: toStatus, ...(extra || {}) });
}

// Đăng ký schedule mở task: SCHEDULED → OPEN khi tới openTime (XXXII)
async function openScheduledTasks(now) {
  const tasks = await listTasks({});
  const opened = [];
  const nowIso = now || new Date().toISOString();
  for (const t of tasks) {
    if (t.STATUS !== config.TASK_STATUS.SCHEDULED) continue;
    const openAt = new Date(t.OPEN_TIME || 0);
    if (openAt.getTime() <= new Date(nowIso).getTime()) {
      await updateTask(t.TASK_ID, { STATUS: config.TASK_STATUS.OPEN });
      opened.push(t.CODE);
    }
  }
  return opened;
}

// -----------------------------------------------------------------------------
// GLOBAL QUEST BOARD (XXXI) — nhóm task cho Mission Board
// =============================================================================
function boardGroup(task, now) {
  const st = task.STATUS;
  if (st === config.TASK_STATUS.OPEN) {
    const openAt = new Date(task.OPEN_TIME || 0);
    const hrs = (now.getTime() - openAt.getTime()) / 3600000;
    if (hrs >= 0 && hrs <= 24) return 'HOT';
    const due = new Date(task.SUBMISSION_DEADLINE || 0);
    if ((due.getTime() - now.getTime()) <= 24 * 3600000) return 'ENDING_SOON';
    return 'AVAILABLE';
  }
  if (st === config.TASK_STATUS.IN_PROGRESS || st === config.TASK_STATUS.SUBMITTED || st === config.TASK_STATUS.AI_CHECK || st === config.TASK_STATUS.HUMAN_REVIEW) return 'ACTIVE';
  if (st === config.TASK_STATUS.COMPLETED || st === config.TASK_STATUS.XP_CREDITED) return 'COMPLETED';
  if (task.IS_TEAM_TASK === 'TRUE') return 'TEAM';
  if (st === config.TASK_STATUS.OPEN && task.SCOPE === config.TASK_TYPES.MANDATORY) return 'MANDATORY';
  return st;
}

async function listBoard(now) {
  const tasks = await listTasks({});
  const nowDate = now || new Date();
  return tasks
    .filter(t => t.STATUS !== config.TASK_STATUS.DRAFT && t.STATUS !== config.TASK_STATUS.ARCHIVED)
    .map(t => ({ ...t, BOARD_GROUP: boardGroup(t, nowDate) }));
}

module.exports = {
  TAB, createTask, getTask, updateTask, listTasks, transition,
  openScheduledTasks, listBoard, nextTaskCounter, defaultDeadlines, ensureTables,
};
