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

  const difficulty = input.difficulty || 'M2';
  const scaleEntry = (config.XP_SCALE && config.XP_SCALE.find(s => s.id === difficulty)) || { value: 1.0 };
  const defaultXp = scaleEntry ? scaleEntry.value : 1.0;
  const rawXpAi = input.xpAiRecommended != null ? toNumber(input.xpAiRecommended) : defaultXp;
  const rawXpFinal = input.xpFinal != null ? toNumber(input.xpFinal) : rawXpAi;

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
    CHANNEL: String(input.channel || 'KENH_CHINH').toUpperCase(),
    TEMPLATE_ID: input.templateId || '',
    XP_AI_RECOMMENDED: round2(rawXpAi),
    XP_FINAL: round2(rawXpFinal),
    XP_OVERRIDE_REASON: input.xpOverrideReason || '',
    DIFFICULTY: difficulty,
    DIFFICULTY_REASON: input.difficultyReason || '',
    ESTIMATED_TIME_MIN: toNumber(input.estimatedTimeMin) || (difficulty === 'M1' ? 30 : difficulty === 'M2' ? 60 : difficulty === 'M3' ? 90 : 120),
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
    STATUS: input.status || config.TASK_STATUS.OPEN,
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
  const byId = await s.get(TAB, 'TASK_ID', ref);
  if (byId) return byId;
  const list = await s.query(TAB, r => String(r.CODE || '').toUpperCase() === String(ref).toUpperCase());
  return list[0] || null;
}

async function updateTask(taskId, patch) {
  await ensureTables();
  const s = store();
  const clean = { ...patch, UPDATED_AT: nowIso() };
  return s.update(TAB, 'TASK_ID', taskId, clean);
}

async function listTasks(filter = {}) {
  await ensureTables();
  const s = store();
  const list = await s.query(TAB, r => {
    if (filter.status && String(r.STATUS || '').toUpperCase() !== String(filter.status).toUpperCase()) return false;
    if (filter.scope && String(r.SCOPE || '').toUpperCase() !== String(filter.scope).toUpperCase()) return false;
    if (filter.department && String(r.DEPARTMENT || '').toUpperCase() !== String(filter.department).toUpperCase()) return false;
    if (filter.channel && String(r.CHANNEL || 'KENH_CHINH').toUpperCase() !== String(filter.channel).toUpperCase()) return false;
    if (filter.createdBy && String(r.CREATED_BY || '') !== String(filter.createdBy)) return false;
    if (filter.templateId && String(r.TEMPLATE_ID || '') !== String(filter.templateId)) return false;
    return true;
  });
  return list;
}

// Chuyển trạng thái task theo quy trình (XI)
async function transition(task, fromStatusList, toStatus, extraPatch = {}) {
  const allowed = Array.isArray(fromStatusList) ? fromStatusList : [fromStatusList];
  if (!allowed.includes(task.STATUS)) {
    throw new Error(`Không thể chuyển trạng thái từ ${task.STATUS} sang ${toStatus}. Cho phép từ: ${allowed.join(', ')}.`);
  }
  return updateTask(task.TASK_ID, { STATUS: toStatus, ...extraPatch });
}

// -----------------------------------------------------------------------------
// CRON: Mở task đã lên lịch (SCHEDULED -> OPEN khi tới OPEN_TIME)
// =============================================================================
async function openScheduledTasks(now) {
  const tasks = await listTasks({ status: config.TASK_STATUS.SCHEDULED });
  const nowDate = now || new Date();
  let opened = 0;
  for (const t of tasks) {
    if (t.OPEN_TIME && new Date(t.OPEN_TIME) <= nowDate) {
      await updateTask(t.TASK_ID, { STATUS: config.TASK_STATUS.OPEN });
      opened++;
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
    .filter(t => t.STATUS !== config.TASK_STATUS.ARCHIVED)
    .map(t => {
      const difficulty = t.DIFFICULTY || 'M2';
      const scaleEntry = config.XP_SCALE.find(s => s.id === difficulty) || config.XP_SCALE[2];
      const xp = (t.XP_FINAL != null && Number(t.XP_FINAL) > 0) ? Number(t.XP_FINAL) : (Number(t.XP_AI_RECOMMENDED) || scaleEntry.value);
      return {
        ...t,
        XP_FINAL: xp,
        STATUS: (t.STATUS === config.TASK_STATUS.DRAFT || !t.STATUS) ? config.TASK_STATUS.OPEN : t.STATUS,
        BOARD_GROUP: boardGroup(t, nowDate)
      };
    });
}

module.exports = {
  TAB, createTask, getTask, updateTask, listTasks, transition,
  openScheduledTasks, listBoard, nextTaskCounter, defaultDeadlines, ensureTables,
};
