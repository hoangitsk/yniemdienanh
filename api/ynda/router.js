'use strict';

// =============================================================================
// YNDA API ROUTER — Express router cho toàn bộ hệ thống vận hành
// Được mount trong index.js (development/production Express) và dùng chung
// logic cho serverless wrapper (api/ynda/*.js).
// =============================================================================

const express = require('express');
const ynda = require('../../lib/ynda');
const auth = require('../../lib/ynda/auth');
const config = require('../../lib/ynda/config');
const { nowIso, toNumber, parseJson, round2 } = require('../../lib/ynda/utils');

const router = express.Router();

// -----------------------------------------------------------------------------
// Public endpoints
// -----------------------------------------------------------------------------
router.get('/config', (req, res) => {
  res.json({
    roles: config.ROLES,
    departments: config.DEPARTMENT_LABELS,
    xpScale: config.XP_SCALE,
    roleDefaults: config.ROLE.DEFAULT_WEEKLY,
    roleConversion: config.ROLE.CONVERSION,
    interaction: config.INTERACTION,
    shareGroup: { base: config.SHARE_GROUP.BASE_GROUP_COUNT, baseBonus: config.SHARE_GROUP.BASE_BONUS }
  });
});

// TASK DETAIL + trạng thái penalty cho user
router.get('/tasks/:ref/detail', auth.requireRole('task', 'view'), async (req, res) => {
  try {
    const { tasks, xp } = ynda;
    const task = await tasks.getTask(req.params.ref);
    if (!task) return res.status(404).json({ error: 'Task không tồn tại.' });
    const user = req.yndaUser;
    const claim = await ynda.claims.activeClaim(task.TASK_ID, user.USER_ID);
    const assignment = (await ynda.assignments.listAssignments({ taskId: task.TASK_ID, assignee: user.USER_ID }))[0] || null;
    const subs = await ynda.submissions.listSubmissions({ taskId: task.TASK_ID, userId: user.USER_ID });
    const penalty = xp.computePenalty({
      taskXp: task.XP_FINAL, workStart: task.WORK_START,
      submissionDeadline: task.SUBMISSION_DEADLINE
    });
    res.json({ task, relation: { claim: claim ? { id: claim.CLAIM_ID, status: claim.STATUS } : null, assignment: assignment ? { id: assignment.ASSIGNMENT_ID, status: assignment.STATUS, policy: assignment.XP_POLICY, type: assignment.ASSIGNMENT_TYPE } : null }, submissions: subs, currentPenalty: penalty });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// MISSION BOARD (Global Quest Board — XXXI)
router.get('/board', async (req, res) => {
  try {
    const board = await ynda.tasks.listBoard(new Date());
    res.json({ board });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// -----------------------------------------------------------------------------
// MISSION BOARD đầy đủ bao gồm nhóm
// -----------------------------------------------------------------------------
router.get('/missions', async (req, res) => {
  try {
    const board = await ynda.tasks.listBoard(new Date());
    const groups = { HOT: [], ENDING_SOON: [], AVAILABLE: [], TEAM: [], MANDATORY: [], COMPLETED: [], ACTIVE: [] };
    const now = new Date();
    for (const t of board) {
      const g = t.BOARD_GROUP;
      if (g === 'HOT') groups.HOT.push(t);
      else if (g === 'ENDING_SOON') groups.ENDING_SOON.push(t);
      else if (g === 'AVAILABLE') groups.AVAILABLE.push(t);
      else if (g === 'COMPLETED') groups.COMPLETED.push(t);
      else if (g === 'TEAM') groups.TEAM.push(t);
      else if (g === 'MANDATORY') groups.MANDATORY.push(t);
      else if (g === 'ACTIVE') groups.ACTIVE.push(t);
    }
    res.json({ groups, updatedAt: now.toISOString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// -----------------------------------------------------------------------------
// AUTH
// -----------------------------------------------------------------------------
// AUTH — login bằng Firebase ID Token (giống web chính)
// -----------------------------------------------------------------------------
router.post('/auth/login', async (req, res) => {
  try {
    const { idToken, token } = req.body || {};
    const t = idToken || token || '';
    if (!t) return res.status(400).json({ error: 'Thiếu idToken của Firebase.' });
    const result = await auth.loginFirebase(t);
    res.json(result);
  } catch (e) {
    res.status(e.code === 'ARCHIVED' ? 403 : 401).json({ error: e.message || 'Xác thực thất bại.' });
  }
});

// Admin tạo/dùng bản ghi thành viên trong Sheet USERS theo email
router.post('/auth/register', auth.requireRole('task', 'create'), async (req, res) => {
  try {
    const user = await auth.getOrCreateByEmail(req.body.email, {
      name: req.body.name, role: req.body.role || 'MEMBER',
      department: req.body.department || 'GLOBAL', phone: req.body.phone
    });
    res.status(201).json({ user });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/auth/me', auth.requireRole('task', 'view'), async (req, res) => {
  res.json({ user: req.yndaUser });
});

router.get('/users', auth.requireRole('task', 'view'), async (req, res) => {
  const users = await auth.listUsers({});
  res.json({ users });
});

// Đồng bộ danh sách thành viên từ sheet ranking (DATABASE CORE / THÀNH VIÊN)
// vào bảng USERS — ranking là nguồn dữ liệu thành viên chính của YNDA.
router.post('/users/sync-ranking', auth.requireRole('task', 'create'), async (req, res) => {
  try {
    const result = await auth.syncUsersFromRanking();
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// -----------------------------------------------------------------------------
// TASKS — CRUD + lifecycle
// -----------------------------------------------------------------------------
router.post('/tasks', auth.requireRole('task', 'create'), async (req, res) => {
  try {
    const task = await ynda.tasks.createTask(req.body, req.yndaUser);
    res.status(201).json({ task });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/tasks', async (req, res) => {
  const tasks = await ynda.tasks.listTasks({
    status: req.query.status, scope: req.query.scope, department: req.query.department
  });
  res.json({ tasks });
});

router.get('/tasks/:ref', async (req, res) => {
  try {
    const t = await ynda.tasks.getTask(req.params.ref);
    if (!t) return res.status(404).json({ error: 'Task không tồn tại.' });
    res.json({ task: t });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/tasks/:ref/analyze', auth.requireRole('task', 'create'), async (req, res) => {
  try {
    const task = await ynda.tasks.getTask(req.params.ref);
    if (!task) return res.status(404).json({ error: 'Task không tồn tại.' });
    const analysis = await ynda.ai.analyzeTask(task, ynda.geminiFactory());
    res.json({ analysis });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/tasks/:ref/status', auth.requireRole('task', 'create'), async (req, res) => {
  try {
    const { to, xpOverride, xpOverrideReason } = req.body || {};
    const task = await ynda.tasks.getTask(req.params.ref);
    if (!task) return res.status(404).json({ error: 'Task không tồn tại.' });
    if (xpOverride) {
      if (!xpOverrideReason) return res.status(400).json({ error: 'Override XP bắt buộc phải có Reason.' });
      await ynda.tasks.updateTask(task.TASK_ID, { XP_FINAL: round2(toNumber(xpOverride)), XP_OVERRIDE_REASON: xpOverrideReason });
    }
    const updated = await ynda.tasks.updateTask(task.TASK_ID, { STATUS: to });
    res.json({ task: updated });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/tasks/:ref/approve', auth.requireRole('task', 'approveTask'), async (req, res) => {
  try {
    const task = await ynda.tasks.getTask(req.params.ref);
    if (!task) return res.status(404).json({ error: 'Task không tồn tại.' });
    const updated = await ynda.tasks.transition(task, [config.TASK_STATUS.DRAFT, config.TASK_STATUS.AI_ANALYSIS], config.TASK_STATUS.APPROVED);
    res.json({ task: updated });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/tasks/:ref/schedule', auth.requireRole('task', 'setDeadlines'), async (req, res) => {
  try {
    const task = await ynda.tasks.getTask(req.params.ref);
    if (!task) return res.status(404).json({ error: 'Task không tồn tại.' });
    const updated = await ynda.tasks.updateTask(task.TASK_ID, {
      STATUS: config.TASK_STATUS.SCHEDULED,
      OPEN_TIME: req.body.openTime || task.OPEN_TIME,
      CLAIM_DEADLINE: req.body.claimDeadline || task.CLAIM_DEADLINE,
      WORK_START: req.body.workStart || task.WORK_START,
      SUBMISSION_DEADLINE: req.body.submissionDeadline || task.SUBMISSION_DEADLINE
    });
    res.json({ task: updated });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/tasks/:ref/open-now', auth.requireRole('task', 'setDeadlines'), async (req, res) => {
  try {
    const task = await ynda.tasks.getTask(req.params.ref);
    if (!task) return res.status(404).json({ error: 'Task không tồn tại.' });
    const updated = await ynda.tasks.updateTask(task.TASK_ID, { STATUS: config.TASK_STATUS.OPEN });
    res.json({ task: updated });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Extend deadline (XXIV: Core có thể gia hạn task được phép)
router.post('/tasks/:ref/extend', auth.requireRole('task', 'extendDeadline'), async (req, res) => {
  try {
    const task = await ynda.tasks.getTask(req.params.ref);
    if (!task) return res.status(404).json({ error: 'Task không tồn tại.' });
    const updated = await ynda.tasks.updateTask(task.TASK_ID, {
      SUBMISSION_DEADLINE: req.body.submissionDeadline,
      ...(req.body.claimDeadline ? { CLAIM_DEADLINE: req.body.claimDeadline } : {})
    });
    res.json({ task: updated });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/tasks/:ref/archive', auth.requireRole('task', 'archive'), async (req, res) => {
  try {
    const task = await ynda.tasks.getTask(req.params.ref);
    if (!task) return res.status(404).json({ error: 'Task không tồn tại.' });
    const updated = await ynda.tasks.updateTask(task.TASK_ID, { STATUS: config.TASK_STATUS.ARCHIVED, ARCHIVED_AT: nowIso() });
    res.json({ task: updated });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// -----------------------------------------------------------------------------
// CLAIM ENGINE
// -----------------------------------------------------------------------------
router.post('/tasks/:ref/claim', auth.requireRole('task', 'claim'), async (req, res) => {
  try {
    const claim = await ynda.claims.claim(req.params.ref, req.yndaUser, req.yndaUser.USER_ID);
    res.status(201).json({ claim });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/claims/:id/start', auth.requireRole('task', 'start'), async (req, res) => {
  try {
    const updated = await ynda.claims.start(req.params.id, req.yndaUser);
    res.json({ claim: updated });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Bắt đầu task (tự tìm claim của user đang đăng nhập)
router.post('/tasks/:ref/start', auth.requireRole('task', 'start'), async (req, res) => {
  try {
    const task = await ynda.tasks.getTask(req.params.ref);
    if (!task) return res.status(404).json({ error: 'Task không tồn tại.' });
    const claim = await ynda.claims.activeClaim(task.TASK_ID, req.yndaUser.USER_ID);
    if (!claim) return res.status(400).json({ error: 'Bạn chưa claim task này.' });
    const updated = await ynda.claims.start(claim.CLAIM_ID, req.yndaUser);
    res.json({ claim: updated });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/claims/:id/release', auth.requireRole('task', 'release'), async (req, res) => {
  try {
    const updated = await ynda.claims.release(req.params.id, req.yndaUser);
    res.json({ claim: updated });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/claims', auth.requireRole('task', 'claim'), async (req, res) => {
  const claims = await ynda.claims.listClaims({ userId: req.yndaUser.USER_ID });
  res.json({ claims });
});

// -----------------------------------------------------------------------------
// ASSIGNMENT ENGINE (riêng biệt)
// -----------------------------------------------------------------------------
router.post('/tasks/:ref/assign', auth.requireRole('task', 'assign'), async (req, res) => {
  try {
    const a = await ynda.assignments.assign(req.params.ref, req.body.assignee, req.yndaUser, {
      assignmentType: req.body.assignmentType, reason: req.body.reason,
      note: req.body.note, dueTime: req.body.dueTime
    });
    res.status(201).json({ assignment: a });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/assignments/:id/respond', auth.requireRole('task', 'respond'), async (req, res) => {
  try {
    const updated = await ynda.assignments.respond(req.params.id, req.yndaUser.USER_ID, req.body.action);
    res.json({ assignment: updated });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/assignments', auth.requireRole('task', 'respond'), async (req, res) => {
  const as = await ynda.assignments.listAssignments({ assignee: req.yndaUser.USER_ID });
  res.json({ assignments: as });
});

// -----------------------------------------------------------------------------
// SUBMISSION + PROOF
// -----------------------------------------------------------------------------
router.post('/tasks/:ref/submit', auth.requireRole('task', 'submit'), async (req, res) => {
  try {
    const sub = await ynda.submissions.submit({
      taskRef: req.params.ref, userId: req.yndaUser.USER_ID,
      proof: req.body.proof, proofFiles: req.body.proofFiles,
      claimId: req.body.claimId, assignmentId: req.body.assignmentId
    });
    res.status(201).json({ submission: sub });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/submissions/:id/ai-check', auth.requireRole('task', 'reviewProof'), async (req, res) => {
  try {
    const { verdict, report } = req.body || {};
    const updated = await ynda.submissions.aiCheck(req.params.id, verdict, report);
    res.json({ submission: updated });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/submissions/:id/ai-verify', auth.requireRole('task', 'reviewProof'), async (req, res) => {
  try {
    const updated = await ynda.aiVerifySubmission(req.params.id);
    res.json({ submission: updated });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/submissions/:id/review', auth.requireRole('task', 'reviewProof'), async (req, res) => {
  try {
    const updated = await ynda.submissions.humanReview(
      req.params.id, req.yndaUser.USER_ID,
      req.body.verdict, req.body.reason, req.body.qualityBonusXp,
      { seasonId: req.body.seasonId }
    );
    res.json(updated);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/submissions', auth.requireRole('task', 'view'), async (req, res) => {
  const subs = await ynda.submissions.listSubmissions({
    taskId: req.query.taskId, userId: req.query.userId || req.yndaUser.USER_ID, status: req.query.status
  });
  res.json({ submissions: subs });
});

// Danh sách submission cần review (task thuộc ban / task được giao)
router.get('/reviews/pending', auth.requireRole('task', 'reviewProof'), async (req, res) => {
  const subs = await ynda.submissions.listSubmissions({ status: config.SUBMISSION_STATUS.HUMAN_REVIEW });
  res.json({ submissions: subs });
});

// -----------------------------------------------------------------------------
// XP LEDGER
// -----------------------------------------------------------------------------
router.get('/ledger', auth.requireRole('task', 'view'), async (req, res) => {
  const txns = await ynda.xp.listUserTxns(req.yndaUser.USER_ID, { seasonId: req.query.seasonId });
  res.json({ transactions: txns });
});

router.get('/xp', auth.requireRole('task', 'view'), async (req, res) => {
  const breakdown = await ynda.xp.computeBreakdown(req.yndaUser.USER_ID, { seasonId: req.query.seasonId });
  res.json(breakdown);
});

// -----------------------------------------------------------------------------
// LEADERBOARD (Overall, Core, Member, Monthly, Top Mỗi Ban + Filters)
// -----------------------------------------------------------------------------
router.get('/leaderboard', async (req, res) => {
  try {
    const { seasonId, month, department, role } = req.query || {};
    const data = await ynda.leaderboard.buildLeaderboard({
      seasonId,
      periodMonth: month,
      department,
      role
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// -----------------------------------------------------------------------------
// ROLE REVIEW (hàng tuần)
// -----------------------------------------------------------------------------
router.get('/role-reviews', auth.requireRole('task', 'reviewMember'), async (req, res) => {
  const reviews = await ynda.roleReview.listReviews({
    seasonId: req.query.seasonId, week: req.query.week, memberId: req.query.memberId
  });
  res.json({ reviews });
});

router.post('/role-reviews', auth.requireRole('task', 'reviewMember'), async (req, res) => {
  try {
    const { seasonId, memberId, note, role } = req.body || {};
    const users = await auth.listUsers({});
    const member = users.find(u => String(u.USER_ID) === String(memberId));
    if (!member) return res.status(400).json({ error: 'Không tìm thấy thành viên.' });
    const review = await ynda.roleReview.createReview({
      seasonId: seasonId || '', team: member.DEPARTMENT, memberId: member.USER_ID,
      memberName: member.NAME, role: role || member.ROLE, reviewer: req.yndaUser.USER_ID, note: note || ''
    });
    res.json({ review });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/role-reviews/generate', auth.requireRole('task', 'reviewMember'), async (req, res) => {
  try {
    const users = await auth.listUsers({});
    const gemini = ynda.geminiFactory();
    const result = await ynda.roleReview.autoGenerateWeeklyReviews({
      seasonId: req.body.seasonId || '', users, reviewer: req.yndaUser.USER_ID, gemini
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/role-reviews/:id/ai-recommend', auth.requireRole('task', 'reviewMember'), async (req, res) => {
  try {
    const updated = await ynda.roleReview.aiRecommend(req.params.id, req.body.recommended, req.body.reason, req.yndaUser.USER_ID);
    res.json({ review: updated });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/role-reviews/:id/approve', auth.requireRole('roleReview', 'approve'), async (req, res) => {
  try {
    const result = await ynda.roleReview.approve(req.params.id, req.yndaUser.USER_ID, req.body.finalPoint, req.body.note);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// -----------------------------------------------------------------------------
// BONUS — Contribution + Share Group
// -----------------------------------------------------------------------------
router.post('/bonus', auth.requireRole('bonus', 'create'), async (req, res) => {
  try {
    const result = await ynda.bonus.createBonus({
      userId: req.body.userId, type: req.body.type, xpVal: req.body.xp,
      proof: req.body.proof, reason: req.body.reason, reviewer: req.body.reviewer || req.yndaUser.USER_ID,
      createdBy: req.yndaUser.USER_ID, seasonId: req.body.seasonId
    });
    res.status(201).json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/bonus/share-group', auth.requireRole('bonus', 'create'), async (req, res) => {
  try {
    const result = await ynda.bonus.createShareGroupBonus({
      userId: req.body.userId, groupCount: req.body.groupCount, validGroups: req.body.validGroups,
      videoProof: req.body.videoProof, reviewer: req.body.reviewer || req.yndaUser.USER_ID,
      seasonId: req.body.seasonId, createdBy: req.yndaUser.USER_ID, groupLink: req.body.groupLink
    });
    res.status(201).json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/interaction', async (req, res) => {
  try {
    const result = await ynda.bonus.recordInteraction({
      taskId: req.body.taskId, userId: req.body.userId,
      platform: req.body.platform, actionsDone: req.body.actionsDone,
      postId: req.body.postId, taskOpenTime: req.body.taskOpenTime
    });
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// -----------------------------------------------------------------------------
// SEASON
// -----------------------------------------------------------------------------
router.get('/seasons', async (req, res) => {
  const seasons = await ynda.season.listSeasons();
  res.json({ seasons });
});

router.post('/seasons', auth.requireRole('season', 'manage'), async (req, res) => {
  try {
    const s = await ynda.season.createSeason({ name: req.body.name, startDate: req.body.startDate, endDate: req.body.endDate, createdBy: req.yndaUser.USER_ID });
    res.status(201).json({ season: s });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/seasons/:id/lock', auth.requireRole('season', 'manage'), async (req, res) => {
  try {
    const s = await ynda.season.lockSeason(req.params.id, req.yndaUser.USER_ID);
    res.json({ season: s });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/seasons/:id/unlock', auth.requireRole('season', 'manage'), async (req, res) => {
  try {
    const s = await ynda.season.unlockSeason(req.params.id, req.yndaUser.USER_ID);
    res.json({ season: s });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// -----------------------------------------------------------------------------
// PRODUCTION (Temporary Production Squad)
// -----------------------------------------------------------------------------
router.get('/production', async (req, res) => {
  const teams = await ynda.production.listTeams({ seasonId: req.query.seasonId });
  res.json({ teams });
});

router.post('/production', auth.requireRole('production', 'create'), async (req, res) => {
  try {
    const t = await ynda.production.createTeam({ name: req.body.name, projectLink: req.body.projectLink, members: req.body.members, seasonId: req.body.seasonId, createdBy: req.yndaUser.USER_ID });
    res.status(201).json({ team: t });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/production/breakdown', auth.requireRole('production', 'create'), async (req, res) => {
  try {
    const result = await ynda.production.proposeBreakdown({ totalXp: req.body.totalXp, members: req.body.members, descriptions: req.body.descriptions });
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// -----------------------------------------------------------------------------
// TASK TEMPLATES
// -----------------------------------------------------------------------------
router.get('/templates', async (req, res) => {
  const ts = await ynda.templates.listTemplates({ department: req.query.department });
  res.json({ templates: ts });
});

router.post('/templates', auth.requireRole('task', 'create'), async (req, res) => {
  try {
    const t = await ynda.templates.createTemplate(req.body, req.yndaUser.USER_ID);
    res.status(201).json({ template: t });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/templates/:ref/materialize', auth.requireRole('task', 'create'), async (req, res) => {
  try {
    const tpl = await ynda.templates.getTemplate(req.params.ref);
    if (!tpl) return res.status(404).json({ error: 'Template không tồn tại.' });
    const materialized = ynda.templates.materializeTemplate(tpl, req.body.overrides || {});
    const task = await ynda.tasks.createTask(materialized, req.yndaUser);
    res.status(201).json({ task, template: tpl });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// -----------------------------------------------------------------------------
// NOTIFICATIONS
// -----------------------------------------------------------------------------
router.get('/notifications', auth.requireRole('task', 'view'), async (req, res) => {
  const notifs = await ynda.notifications.listForUser(req.yndaUser.USER_ID);
  res.json({ notifications: notifs });
});

router.post('/notifications/:id/read', auth.requireRole('task', 'view'), async (req, res) => {
  try {
    const n = await ynda.notifications.markRead(req.params.id, req.yndaUser.USER_ID);
    res.json({ notification: n });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// -----------------------------------------------------------------------------
// DASHBOARD — tổng hợp theo user
// -----------------------------------------------------------------------------
router.get('/dashboard', auth.requireRole('task', 'view'), async (req, res) => {
  try {
    const d = await ynda.getDashboard(req.yndaUser.USER_ID);
    res.json(d);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// -----------------------------------------------------------------------------
// AUDIT LOGS
// -----------------------------------------------------------------------------
router.get('/audit', auth.requireRole('task', 'audit'), async (req, res) => {
  try {
    const logs = await ynda.audit.list({ entityId: req.query.entityId, action: req.query.action });
    res.json({ logs });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// -----------------------------------------------------------------------------
// MESSENGER EVENT (push — web là nguồn dữ liệu chính)
// -----------------------------------------------------------------------------
router.post('/messenger/event', async (req, res) => {
  try {
    const evt = await ynda.notifications.pushMessengerEvent(req.body.event, req.body.payload, null);
    res.json({ event: evt });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
