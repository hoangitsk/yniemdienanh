'use strict';

// =============================================================================
// YNDA NOTIFICATIONS + MESSENGER EVENTS (XLIV)
// -----------------------------------------------------------------------------
// Messenger Bot CHỈ nhận event từ Web (web là nguồn dữ liệu chính).
// Bot không chứa logic điểm, không tạo hai hệ thống điểm song song.
// Events: 🔔 task opened, ⏰ task ending, ⚠️ entering penalty window,
//         🎯 task assigned, ❌ proof returned, ✅ proof approved, 🏆 rank changed
// =============================================================================

const { store, uid } = require('./store');
const { SCHEMA } = require('./schema');
const config = require('./config');
const { nowIso } = require('./utils');

const TAB = 'NOTIFICATIONS';

const EVENT_TYPES = config.MESSENGER_EVENTS;

async function ensureTables() {
  await store().ensureTable(TAB, SCHEMA.NOTIFICATIONS);
}

async function notify({ userId, channel = 'WEB', type, title, body, link }) {
  await ensureTables();
  const record = {
    NOTIFICATION_ID: uid('NOTIF'),
    USER_ID: userId,
    CHANNEL: channel,
    TYPE: type,
    TITLE: title || '',
    BODY: body || '',
    LINK: link || '',
    STATUS: 'UNREAD',
    CREATED_AT: nowIso(),
    READ_AT: ''
  };
  await store().insert(TAB, record);
  return record;
}

// Web là nguồn chính; ghi notification, sau đó (nếu configure messenger webhook)
// gửi event qua POST. KHÔNG chứa logic điểm.
async function pushMessengerEvent(eventType, payload, messengerWebhook) {
  if (!EVENT_TYPES.includes(eventType)) {
    throw new Error(`Messenger event ${eventType} không hợp lệ.`);
  }
  const evt = { event: eventType, payload, sentAt: nowIso() };

  // Ghi notification WEB trước (luôn đúng) nếu có userId
  if (payload.userId) {
    const titleFor = {
      TASK_OPENED: `🔔 ${payload.taskCode} đã mở`,
      TASK_ENDING: `⏰ ${payload.taskCode} sắp hết hạn`,
      TASK_PENALTY_WINDOW: `⚠️ ${payload.taskCode} bắt đầu tính penalty`,
      TASK_ASSIGNED: `🎯 Bạn được giao ${payload.taskCode}`,
      PROOF_RETURNED: `❌ Proof ${payload.taskCode} bị trả lại`,
      PROOF_APPROVED: `✅ Proof ${payload.taskCode} được duyệt`,
      RANK_CHANGED: `🏆 Thứ hạng của bạn thay đổi`
    };
    await notify({
      userId: payload.userId,
      channel: 'WEB',
      type: eventType,
      title: titleFor[eventType] || eventType,
      body: payload.message || payload.taskCode || '',
      link: payload.link || `#/task/${payload.taskId || ''}`
    });
  }

  // Gửi event ra messenger/backend tích hợp nếu có webhook
  if (messengerWebhook && typeof messengerWebhook === 'function') {
    try {
      await messengerWebhook(evt);
    } catch (e) {
      console.warn('[Messenger] push failed:', e.message);
    }
  }
  return evt;
}

async function listForUser(userId, opts = {}) {
  let rows = await store().list(TAB);
  rows = rows.filter(r => String(r.USER_ID || '') === String(userId));
  rows.sort((a, b) => String(b.CREATED_AT).localeCompare(String(a.CREATED_AT)));
  return rows;
}

async function markRead(notificationId, userId) {
  const s = store();
  const notif = await s.get(TAB, 'NOTIFICATION_ID', String(notificationId));
  if (!notif || String(notif.USER_ID || '') !== String(userId)) throw new Error('Notification không hợp lệ.');
  return s.update(TAB, 'NOTIFICATION_ID', String(notificationId), { STATUS: 'READ', READ_AT: nowIso() });
}

module.exports = { TAB, notify, pushMessengerEvent, listForUser, markRead, ensureTables, EVENT_TYPES };