'use strict';

// =============================================================================
// YNDA AUDIT LOG ENGINE (XLVII)
// Mọi thay đổi quan trọng phải có audit trail. Không xóa lịch sử.
// =============================================================================

const { store, uid } = require('./store');
const { SCHEMA } = require('./schema');
const { nowIso, safeJson } = require('./utils');

const TAB = 'AUDIT_LOGS';

async function ensureTables() {
  await store().ensureTable(TAB, SCHEMA.AUDIT_LOGS);
}

async function log({ actor, actorRole, action, entityType, entityId, before, after, reason }) {
  await ensureTables();
  const record = {
    LOG_ID: uid('LOG'),
    TIME: nowIso(),
    ACTOR: actor || 'system',
    ACTOR_ROLE: actorRole || '',
    ACTION: action || 'GENERIC',
    ENTITY_TYPE: entityType || '',
    ENTITY_ID: entityId || '',
    BEFORE: safeJson(before, null),
    AFTER: safeJson(after, null),
    REASON: reason || '',
    CREATED_AT: nowIso()
  };
  await store().insert(TAB, record);
  return record;
}

async function list(filter = {}) {
  let rows = await store().list(TAB);
  if (filter.entityId) rows = rows.filter(r => String(r.ENTITY_ID || '') === String(filter.entityId));
  if (filter.action) rows = rows.filter(r => String(r.ACTION || '') === String(filter.action));
  if (filter.actor) rows = rows.filter(r => String(r.ACTOR || '') === String(filter.actor));
  rows.sort((a, b) => String(b.TIME).localeCompare(String(a.TIME)));
  return rows;
}

module.exports = { TAB, log, list, ensureTables };