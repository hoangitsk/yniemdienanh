'use strict';

// =============================================================================
// YNDA CRON — DEADLINE ENGINE + MANDATORY ESCALATION + PENALTY WINDOW
// -----------------------------------------------------------------------------
// Chạy định kỳ:
//   1. SCHEDULED → OPEN khi tới Open Time (XXXII — Task Calendar)
//   2. MANDATORY: hết claim deadline mà không ai nhận → auto-escalate (VII.C)
//   3. Đẩy Messenger events: TASK_OPENED, TASK_ENDING, TASK_PENALTY_WINDOW
//   4. Tính penalty khi vào Work Start (XIII)
// =============================================================================

const ynda = require('../../lib/ynda');
const config = require('../../lib/ynda/config');
const notifications = require('../../lib/ynda/notifications');
const { nowIso, toNumber } = require('../../lib/ynda/utils');

async function tick(req, res) {
  try {
    // nếu chưa có store, init memory (tránh crash nếu thiếu env trong cron)
    if (!ynda.store.store().tables && process.env.YNDA_SPREADSHEET_ID) {
      ynda.store.initStore();
    }
    const results = { opened: [], escalated: [], endingSoon: [], penaltyWindows: [], usersSynced: null, errors: [] };

    // 0) Đồng bộ danh sách thành viên từ sheet ranking -> USERS
    try {
      if (process.env.GOOGLE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT) {
        results.usersSynced = await ynda.auth.syncUsersFromRanking();
      }
    } catch (e) { results.errors.push('userSync: ' + e.message); }

    // 1) Mở task scheduled
    try {
      const opened = await ynda.tasks.openScheduledTasks(new Date().toISOString());
      results.opened = opened;
      for (const code of opened) {
        const task = await ynda.tasks.getTask(code);
        await notifications.pushMessengerEvent('TASK_OPENED', {
          taskId: task.TASK_ID, taskCode: code, userId: null,
          message: `${code} đã mở — claim trước deadline`
        });
      }
    } catch (e) { results.errors.push('openScheduled: ' + e.message); }

    // 2) MANDATORY escalation
    try {
      const tasks = await ynda.tasks.listTasks({});
      for (const t of tasks) {
        if (String(t.SCOPE || '').toUpperCase() !== config.TASK_TYPES.MANDATORY) continue;
        const r = await ynda.assignments.checkMandatoryEscalation(t.TASK_ID);
        if (r.status === 'escalated') {
          results.escalated.push(t.CODE);
          await notifications.pushMessengerEvent('TASK_ASSIGNED', {
            taskId: t.TASK_ID, taskCode: t.CODE, userId: null,
            message: `${t.CODE} không có người nhận, đã chuyển sang giao bắt buộc`
          });
        }
      }
    } catch (e) { results.errors.push('mandatoryEscalate: ' + e.message); }

    // 3) Task sắp hết hạn (24h) + 4) bắt đầu penalty window
    try {
      const now = Date.now();
      const tasks = await ynda.tasks.listTasks({});
      for (const t of tasks) {
        const activeStatuses = [
          config.TASK_STATUS.OPEN, config.TASK_STATUS.CLAIMED,
          config.TASK_STATUS.ASSIGNED, config.TASK_STATUS.ACTIVE,
          config.TASK_STATUS.IN_PROGRESS, config.TASK_STATUS.SUBMITTED
        ];
        if (!activeStatuses.includes(t.STATUS)) continue;

        const due = new Date(t.SUBMISSION_DEADLINE || 0).getTime();
        if (due - now <= 24 * 3600 * 1000 && due - now > 0) {
          results.endingSoon.push(t.CODE);
          await notifications.pushMessengerEvent('TASK_ENDING', {
            taskId: t.TASK_ID, taskCode: t.CODE, userId: null,
            message: `${t.CODE} sắp hết hạn trong 24h`
          });
        }

        const ws = new Date(t.WORK_START || 0).getTime();
        const sd = new Date(t.SUBMISSION_DEADLINE || 0).getTime();
        if (now >= ws && now < sd) {
          results.penaltyWindows.push(t.CODE);
          await notifications.pushMessengerEvent('TASK_PENALTY_WINDOW', {
            taskId: t.TASK_ID, taskCode: t.CODE, userId: null,
            message: `${t.CODE} bắt đầu tính penalty`
          });
        }
      }
    } catch (e) { results.errors.push('deadlineScan: ' + e.message); }

    if (res) res.json({ success: true, at: nowIso(), results });
    return results;
  } catch (e) {
    if (res) return res.status(500).json({ success: false, error: e.message });
    return { success: false, error: e.message };
  }
}

module.exports = { tick };