'use strict';

// =============================================================================
// YNDA PRODUCTION ENGINE (XXV, XXVI, XXVII)
// -----------------------------------------------------------------------------
// Production KHÔNG phải Ban thứ 6 cố định. Là Temporary Production Squad
// theo từng video/dự án. Chức danh: Producer, Director/Cinematographer (có
// thể bổ sung Actor, Editor, Lighting, Sound, Art, Assistant). Có thể 1 hoặc
// 2 production team cùng làm. Production dùng cùng Task Engine, không có hệ
// điểm bí mật riêng. Task nhóm: Total XP, AI đề xuất breakdown hoặc chia đều.
// =============================================================================

const { store, uid } = require('./store');
const { SCHEMA } = require('./schema');
const config = require('./config');
const { nowIso, round2, toNumber, parseJson } = require('./utils');
const audit = require('./audit');

const TAB = 'PRODUCTION_TEAMS';

async function ensureTables() {
  await store().ensureTable(TAB, SCHEMA.PRODUCTION_TEAMS);
}

async function createTeam({ name, projectLink, members, seasonId, createdBy }) {
  await ensureTables();
  const teamId = uid('PROD');
  const record = {
    TEAM_ID: teamId,
    NAME: name || 'Production Team',
    PROJECT_LINK: projectLink || '',
    STATUS: 'ACTIVE',
    MEMBERS: Array.isArray(members) ? JSON.stringify(members) : '',
    TASK_IDS: '',
    SEASON_ID: seasonId || '',
    CREATED_BY: createdBy || '',
    CREATED_AT: nowIso()
  };
  await store().insert(TAB, record);
  await audit.log({ actor: createdBy || 'system', action: 'TASK', entityType: 'PRODUCTION_TEAMS', entityId: teamId, after: record });
  return record;
}

async function listTeams(filter = {}) {
  let rows = await store().list(TAB);
  if (filter.seasonId) rows = rows.filter(r => String(r.SEASON_ID || '') === String(filter.seasonId));
  return rows;
}

async function updateTeam(teamId, patch) {
  const s = store();
  const prev = await s.get(TAB, 'TEAM_ID', String(teamId));
  if (!prev) return null;
  return s.update(TAB, 'TEAM_ID', String(teamId), patch);
}

// -----------------------------------------------------------------------------
// TASK NHÓM (XXVII): Total XP. Nếu có mô tả riêng từng người, AI đề xuất
// breakdown (A=10, B=8...). Nếu không, chia đều.
// =============================================================================
async function proposeBreakdown({ totalXp, members, descriptions }) {
  const total = toNumber(totalXp);
  if (!members || !members.length) return { breakdown: {}, method: 'none' };

  const hasIndividualDescriptions = descriptions && members.some(m => descriptions[m.userId || m]);
  if (!hasIndividualDescriptions) {
    // chia đều
    const each = round2(total / members.length);
    const breakdown = {};
    members.forEach(m => { breakdown[m.userId || m] = each; });
    return { breakdown, method: 'equal' };
  }
  // mô tả riêng → phân bổ theo số ký tự mô tả (heuristic nếu không có AI)
  const weights = {};
  members.forEach(m => {
    weights[m.userId || m] = Math.max(1, String(descriptions[m.userId || m] || '').length);
  });
  const wSum = Object.values(weights).reduce((s, v) => s + v, 0);
  const breakdown = {};
  members.forEach(m => {
    breakdown[m.userId || m] = round2(total * weights[m.userId || m] / wSum);
  });
  return { breakdown, method: 'weighted' };
}

module.exports = { TAB, createTeam, listTeams, updateTeam, proposeBreakdown, ensureTables };