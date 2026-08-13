'use strict';

// =============================================================================
// YNDA SEASON ENGINE (XXXIX, XL)
// -----------------------------------------------------------------------------
// Season 1 kết thúc → Season 1 Score khóa. Season 2 Overall hiện tại = 0.
// Database vẫn lưu: Season 1 / Season 2 / Lifetime. Lifetime chưa hiển thị.
// =============================================================================

const { store, uid } = require('./store');
const { SCHEMA } = require('./schema');
const config = require('./config');
const { nowIso, toNumber } = require('./utils');
const audit = require('./audit');

const S_TAB = 'SEASONS';
const SS_TAB = 'SEASON_SCORES';

async function ensureTables() {
  const s = store();
  await s.ensureTable(S_TAB, SCHEMA.SEASONS);
  await s.ensureTable(SS_TAB, SCHEMA.SEASON_SCORES);
}

async function createSeason({ name, startDate, endDate, createdBy }) {
  await ensureTables();
  const seasonId = uid('SEA');
  const record = {
    SEASON_ID: seasonId,
    NAME: name || `Season ${(await listSeasons()).length + 1}`,
    START_DATE: startDate || nowIso(),
    END_DATE: endDate || '',
    STATUS: config.SEASON_STATUS.ACTIVE,
    LOCKED_AT: '',
    CREATED_BY: createdBy || '',
    CREATED_AT: nowIso()
  };
  await store().insert(S_TAB, record);
  await audit.log({ actor: createdBy || 'system', action: 'TASK', entityType: 'SEASONS', entityId: seasonId, after: record });
  return record;
}

async function listSeasons() {
  return store().list(S_TAB);
}

async function getActiveSeason() {
  const seasons = await store().list(S_TAB);
  return seasons.find(s => s.STATUS === config.SEASON_STATUS.ACTIVE) || null;
}

// Lock season: điểm được khóa, không thể thay đổi nữa (XXXIX)
async function lockSeason(seasonId, actor) {
  await ensureTables();
  const s = store();
  const seasonRow = await s.get(S_TAB, 'SEASON_ID', String(seasonId));
  if (!seasonRow) throw new Error('Season không tồn tại.');
  const updated = await s.update(S_TAB, 'SEASON_ID', String(seasonId), {
    STATUS: config.SEASON_STATUS.LOCKED,
    LOCKED_AT: nowIso()
  });
  // Snapshot điểm mùa khóa vào SEASON_SCORES
  const { buildLeaderboard } = require('./leaderboard');
  const lb = await buildLeaderboard({ seasonId });
  for (const e of lb.all) {
    await s.insert(SS_TAB, {
      SCORE_ID: uid('SC'),
      SEASON_ID: seasonId,
      USER_ID: e.userId,
      SCORE_TYPE: 'OVERALL',
      SCORE_VALUE: e.overall,
      CREATED_AT: nowIso()
    });
  }
  await audit.log({ actor, action: 'TASK', entityType: 'SEASONS', entityId: seasonId, after: { status: 'LOCKED' } });
  return updated;
}

async function unlockSeason(seasonId, actor) {
  const s = store();
  const seasonRow = await s.get(S_TAB, 'SEASON_ID', String(seasonId));
  if (!seasonRow) throw new Error('Season không tồn tại.');
  return s.update(S_TAB, 'SEASON_ID', String(seasonId), { STATUS: config.SEASON_STATUS.ACTIVE, LOCKED_AT: '' });
}

module.exports = { createSeason, listSeasons, getActiveSeason, lockSeason, unlockSeason, ensureTables };