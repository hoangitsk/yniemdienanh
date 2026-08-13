'use strict';

// =============================================================================
// YNDA BONUS ENGINE (XXVIII) + SHARE GROUP (XVIII) + INTERACTION (XV-XVII)
// -----------------------------------------------------------------------------
// Contribution Bonus: Founder/BĐH tạo Bonus khi member tự đóng góp lớn.
// BẮT BUỘC có: Proof + Reason + Reviewer. Không cộng điểm chỉ vì "tích cực".
// Share Group bonus theo bảng (XVIII). KHÔNG cộng dồn.
// Interaction Mission (XV): platform × action, EARLY/LATE window, chống farm.
// =============================================================================

const { store, uid } = require('./store');
const { SCHEMA } = require('./schema');
const config = require('./config');
const { nowIso, round2, toNumber, parseJson } = require('./utils');
const xp = require('./xp');
const audit = require('./audit');

const TAB = 'BONUS_TRANSACTIONS';
const INT_TAB = 'INTERACTIONS';

async function ensureTables() {
  const s = store();
  await s.ensureTable(TAB, SCHEMA.BONUS_TRANSACTIONS);
  await s.ensureTable(INT_TAB, SCHEMA.INTERACTIONS);
}

// -----------------------------------------------------------------------------
// CONTRIBUTION BONUS — phải có proof + reason + reviewer
// =============================================================================
async function createBonus({ userId, type, xpVal, proof, reason, reviewer, createdBy, seasonId, groupCount, groupLink }) {
  await ensureTables();
  if (!userId) throw new Error('Thiếu user nhận bonus.');
  if (!reason || !reason.trim()) throw new Error('Contribution Bonus bắt buộc phải có Reason.');
  if (!proof || !proof.trim()) throw new Error('Contribution Bonus bắt buộc phải có Proof.');
  if (!reviewer) throw new Error('Contribution Bonus bắt buộc phải có Reviewer.');
  if (toNumber(xpVal) <= 0) throw new Error('Bonus XP phải > 0.');

  const bonusType = String(type || 'CONTRIBUTION').toUpperCase();
  const bonusId = uid('BON');

  const record = {
    BONUS_ID: bonusId,
    USER_ID: userId,
    TYPE: bonusType,
    XP: round2(toNumber(xpVal)),
    PROOF: proof || '',
    REASON: reason,
    REVIEWER: reviewer,
    STATUS: 'APPROVED',
    CREATED_BY: createdBy || '',
    CREATED_AT: nowIso(),
    SEASON_ID: seasonId || '',
    GROUP_COUNT: toNumber(groupCount),
    GROUP_LINK: groupLink || ''
  };
  await store().insert(TAB, record);

  // Ghi vào XP ledger
  const txn = await xp.recordTxn({
    user: userId,
    type: config.XP_TYPES.BONUS,
    sourceId: bonusId,
    sourceName: bonusType === 'SHARE_GROUP' ? `${bonusType} — ${groupCount} groups` : `${bonusType} — ${reason.slice(0, 60)}`,
    rawPoint: record.XP,
    reviewer,
    notes: reason,
    createdBy: createdBy || reviewer,
    seasonId
  });

  await audit.log({
    actor: createdBy || reviewer, action: 'BONUS', entityType: 'BONUS_TRANSACTIONS', entityId: bonusId,
    after: { userId, xp: record.XP, reason, proof, reviewer }
  });
  return { ...record, XP_TXN: txn };
}

// -----------------------------------------------------------------------------
// SHARE GROUP BONUS (XVIII, XIX, XX) — group phải khác nhau
// Bảng: 10→+0.25, 20→+0.50, 40→+0.75, 80→+1.00, 160→+1.25, 320→+1.50,
//        640→+1.75, 1280→+2.00
// Mỗi group tính 1 lần. KHÔNG cộng dồn. 20 group trở lên phải quay video proof.
// =============================================================================
function shareGroupBonus(validGroupCount) {
  return config.SHARE_GROUP.BONUS(validGroupCount);
}

async function createShareGroupBonus({ userId, groupCount, validGroups, videoProof, reviewer, seasonId, createdBy, groupLink }) {
  await ensureTables();
  const count = toNumber(groupCount);
  if (count >= 20 && !videoProof) {
    throw new Error('Từ 20 group trở lên phải có video proof (lịch sử share/danh sách group/quá trình thực hiện).');
  }
  const validCount = Array.isArray(validGroups) ? validGroups.length : count;
  const xpVal = shareGroupBonus(validCount);
  if (xpVal <= 0) throw new Error('Số group hợp lệ quá ít (< 10).');

  return createBonus({
    userId, type: 'SHARE_GROUP', xpVal, proof: videoProof || `Share ${validCount} group`,
    reason: `Share ${validCount} groups hợp lệ (bonus không cộng dồn)`, reviewer, createdBy, seasonId,
    groupCount: validCount, groupLink
  });
}

// -----------------------------------------------------------------------------
// INTERACTION MISSION (XV, XVI, XVII)
//   EARLY: trong 1h đầu từ lúc đăng bài, 1 platform đủ 3 hành động = +0.5 XP
//   LATE : sau 1h trong 24h, 1 platform đủ 3 hành động = +0.25 XP
//   Mỗi Platform × Action chỉ tính 1 lần (chống farm: react 20 lần ≠ 20 lần).
// =============================================================================
async function recordInteraction({ taskId, userId, platform, actionsDone, postId, taskOpenTime }) {
  await ensureTables();
  const s = store();
  const plat = String(platform || '').toUpperCase();
  if (!config.INTERACTION.PLATFORMS.includes(plat)) throw new Error(`Platform ${plat} không hợp lệ.`);

  const done = Array.isArray(actionsDone) ? actionsDone : [];
  const uniqueActions = [...new Set(done.map(a => String(a).toUpperCase()))].filter(a => config.INTERACTION.ACTIONS.includes(a));
  if (uniqueActions.length < 3) {
    throw new Error('Platform phải đủ 3 hành động (React + Share + Comment) mới tính điểm.');
  }

  // Chống farm: mỗi Platform × Action chỉ tính 1 lần
  const existing = await s.list(INT_TAB);
  const dupe = existing.some(r =>
    String(r.TASK_ID || '') === String(taskId) &&
    String(r.USER_ID || '') === String(userId) &&
    String(r.PLATFORM || '') === String(plat) &&
    String(r.POST_ID || '') === String(postId || ''));
  if (dupe) return { duplicated: true, xp: 0 };

  // Xác định window
  const openAt = new Date(taskOpenTime || 0);
  const now = new Date();
  const hoursSinceOpen = (now.getTime() - openAt.getTime()) / 3600000;
  let window = null;
  let xpVal = 0;
  if (hoursSinceOpen >= 0 && hoursSinceOpen <= config.INTERACTION.EARLY_WINDOW_HOURS) {
    window = 'EARLY';
    xpVal = config.INTERACTION.EARLY_XP_PER_PLATFORM;
  } else if (hoursSinceOpen <= config.INTERACTION.LATE_WINDOW_HOURS) {
    window = 'LATE';
    xpVal = config.INTERACTION.LATE_XP_PER_PLATFORM;
  } else {
    throw new Error('Đã quá 24h kể từ lúc đăng bài, không còn được tính Interaction XP.');
  }

  // Ghi record dedupe cho từng action
  const dedupeKeys = uniqueActions.map(a => `${taskId}|${userId}|${plat}|${postId || ''}|${a}`);
  for (const key of dedupeKeys) {
    await s.insert(INT_TAB, {
      INTERACTION_ID: uid('INT'),
      TASK_ID: taskId,
      USER_ID: userId,
      PLATFORM: plat,
      ACTION: uniqueActions.find(a => key.endsWith(a)),
      WINDOW: window,
      SUMMARY_ID: '',
      POST_ID: postId || '',
      DEDUPE_KEY: key,
      CREATED_AT: nowIso()
    });
  }

  // Tạo transaction INTERACTION
  const txn = await xp.recordTxn({
    user: userId,
    type: config.XP_TYPES.INTERACTION,
    sourceId: taskId,
    sourceName: `Interaction ${plat} (${window})`,
    rawPoint: xpVal,
    reviewer: 'system-interaction',
    notes: `${uniqueActions.join('+')} trên ${plat} trong ${window} window`,
    createdBy: 'system'
  });

  return { duplicated: false, window, xp: xpVal, actions: uniqueActions, XP_TXN: txn };
}

async function listBonuses(filter = {}) {
  let rows = await store().list(TAB);
  if (filter.userId) rows = rows.filter(r => String(r.USER_ID || '') === String(filter.userId));
  if (filter.type) rows = rows.filter(r => String(r.TYPE || '') === String(filter.type));
  return rows;
}

module.exports = { TAB, createBonus, createShareGroupBonus, shareGroupBonus, recordInteraction, listBonuses, ensureTables };