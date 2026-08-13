'use strict';

// =============================================================================
// YNDA TASK TEMPLATE ENGINE (XXXIII)
// -----------------------------------------------------------------------------
// Nhiệm vụ lặp lại dùng Template. VD: BUMP_POST_V1 có sẵn XP suggestion,
// Proof, Deadline, AI check, Reviewer. Core chỉ sửa Post ID, ngày, deadline.
// =============================================================================

const { store, uid } = require('./store');
const { SCHEMA } = require('./schema');
const config = require('./config');
const { nowIso, toNumber, parseJson } = require('./utils');
const audit = require('./audit');

const TAB = 'TASK_TEMPLATES';

async function ensureTables() {
  await store().ensureTable(TAB, SCHEMA.TASK_TEMPLATES);
}

async function createTemplate(input, actor) {
  await ensureTables();
  const templateId = uid('TPL');
  const record = {
    TEMPLATE_ID: templateId,
    CODE: input.code || '',
    NAME: input.name || '',
    DESCRIPTION: input.description || '',
    SCOPE: input.scope || config.TASK_TYPES.GLOBAL_OPEN,
    DEPARTMENT: input.department || 'GLOBAL',
    XP_SUGGESTION: input.xpSuggestion != null ? toNumber(input.xpSuggestion) : 0,
    PROOF_FORMAT: input.proofFormat || '',
    DEFAULT_OPEN: input.defaultOpen || '',
    DEFAULT_CLAIM: input.defaultClaim || '',
    DEFAULT_WORK: input.defaultWork || '',
    DEFAULT_SUBMIT: input.defaultSubmit || '',
    AI_VERIFY: String(input.aiVerify ?? 'YES').toUpperCase(),
    REVIEWER_ROLE: input.reviewerRole || '',
    REVIEWER_DEPARTMENT: input.reviewerDepartment || '',
    FIELDS: input.fields ? JSON.stringify(input.fields) : ''
  };
  await store().insert(TAB, record);
  await audit.log({ actor: actor || 'system', action: 'TASK', entityType: 'TASK_TEMPLATES', entityId: templateId, after: record });
  return record;
}

async function listTemplates(filter = {}) {
  let rows = await store().list(TAB);
  if (filter.department) rows = rows.filter(r => String(r.DEPARTMENT || '') === String(filter.department));
  if (filter.code) rows = rows.filter(r => String(r.CODE || '') === String(filter.code));
  return rows;
}

async function getTemplate(ref) {
  const rows = await store().list(TAB);
  return rows.find(r => String(r.TEMPLATE_ID) === String(ref) || String(r.CODE) === String(ref)) || null;
}

// Lấy template, sinh input cho createTask với deadline mặc định + fields
function materializeTemplate(template, overrides = {}) {
  const fields = parseJson(template.FIELDS, {});
  const now = new Date();
  const add = (ms) => new Date(now.getTime() + ms).toISOString();
  const resolve = (key, fallbackMs) => {
    const raw = template['DEFAULT_' + key.toUpperCase()] || overrides[key];
    if (typeof raw === 'string' && raw) return raw;
    if (typeof raw === 'number') return add(raw);
    return add(fallbackMs);
  };

  return {
    title: overrides.title || fields.title || template.NAME,
    description: overrides.description || fields.description || template.DESCRIPTION,
    expectedOutput: overrides.expectedOutput || fields.expectedOutput || '',
    scope: overrides.scope || template.SCOPE,
    department: overrides.department || template.DEPARTMENT,
    templateId: template.TEMPLATE_ID,
    xpFinal: overrides.xpFinal != null ? overrides.xpFinal : toNumber(template.XP_SUGGESTION),
    proofFormat: overrides.proofFormat || template.PROOF_FORMAT,
    aiVerify: overrides.aiVerify || template.AI_VERIFY,
    reviewerRole: overrides.reviewerRole || template.REVIEWER_ROLE,
    reviewerDepartment: overrides.reviewerDepartment || template.REVIEWER_DEPARTMENT,
    openTime: overrides.openTime || resolve('open', 0),
    claimDeadline: overrides.claimDeadline || resolve('claim', 3600 * 1000),
    workStart: overrides.workStart || resolve('work', 24 * 3600 * 1000),
    submissionDeadline: overrides.submissionDeadline || resolve('submit', 3 * 24 * 3600 * 1000),
    ...(Object.keys(overrides).reduce((acc, k) => {
      if (!['title', 'description', 'expectedOutput', 'scope', 'department', 'xpFinal', 'proofFormat', 'aiVerify', 'reviewerRole', 'reviewerDepartment', 'openTime', 'claimDeadline', 'workStart', 'submissionDeadline'].includes(k)) acc[k] = overrides[k];
      return acc;
    }, {}))
  };
}

module.exports = { TAB, createTemplate, listTemplates, getTemplate, materializeTemplate, ensureTables };