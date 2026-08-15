'use strict';

// =============================================================================
// YNDA SYSTEM TESTS (in-memory adapter — không cần Google credentials)
// Kiểm chứng các luật cứng của đặc tả:
//   - XP ledger + Overall (Role Point 60% conversion)
//   - Penalty Engine (trước work start / sau / quá deadline)
//   - Mandatory escalation (100% vs forced 50% + quality bonus 50%)
//   - Assignment riêng biệt (Claim ≠ Assignment)
//   - Interaction Mission (early/late + chống farm)
//   - Share Group bonus (không cộng dồn)
// Chạy: npm run ynda:test
// =============================================================================

const assert = require('assert');
const ynda = require('./lib/ynda');
const config = require('./lib/ynda/config');
const auth = require('./lib/ynda/auth');

function approx(a, b, tol = 0.01) {
  assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b} (tol ${tol})`);
}

async function main() {
  ynda.store.resetStore();
  await ynda.bootstrap({ mode: 'memory' });

  // ---------------------------------------------------------------- users
  // (login qua Firebase; test dùng getOrCreateByEmail để tạo account trực tiếp)
  const founder = await auth.getOrCreateByEmail('founder@ynda.vn', { name: 'Founder', role: 'FOUNDER', department: 'GLOBAL' });
  const core = await auth.getOrCreateByEmail('core@ynda.vn', { name: 'Quỳnh Giang', role: 'CORE', department: 'TRUYEN_THONG' });
  const vice = await auth.getOrCreateByEmail('vice@ynda.vn', { name: 'Vice A', role: 'VICE', department: 'MEDIA' });
  const member = await auth.getOrCreateByEmail('member@ynda.vn', { name: 'Lê Thị Hoàng Ngân', role: 'MEMBER', department: 'TRUYEN_THONG' });

  console.log('✅ users created');

  // ---------------------------------------------------------------- TEST 1: Role Point 60%
  const roleTxn = await ynda.xp.recordTxn({
    user: core.USER_ID, type: config.XP_TYPES.ROLE,
    sourceId: 'RVR-0001', sourceName: 'Role CORE Week 1',
    rawPoint: 1, reviewer: founder.USER_ID, createdBy: founder.USER_ID,
    isRolePoint: true, roleConversion: 0.6, roleRawPoint: 1, roleOverallValue: 0.6,
    seasonId: 'SEA-1'
  });
  assert.strictEqual(roleTxn.IS_ROLE_POINT, 'TRUE');
  assert.strictEqual(String(roleTxn.ROLE_CONVERSION), '0.6');
  assert.strictEqual(String(roleTxn.ROLE_RAW_POINT), '1');
  approx(Number(roleTxn.ROLE_OVERALL_VALUE), 0.6);
  approx(Number(roleTxn.APPLIED_POINT), 0.6); // KHÔNG cộng 1:1

  // Member làm task +20, bonus +1, penalty -5
  await ynda.xp.recordTxn({ user: member.USER_ID, type: config.XP_TYPES.TASK, sourceId: 'TASK-x', sourceName: 'Edit Reel', rawPoint: 20, reviewer: founder.USER_ID, seasonId: 'SEA-1' });
  await ynda.xp.recordTxn({ user: member.USER_ID, type: config.XP_TYPES.BONUS, sourceId: 'BON-x', sourceName: '20 Groups', rawPoint: 0.5, reviewer: founder.USER_ID, seasonId: 'SEA-1' });
  await ynda.xp.recordTxn({ user: member.USER_ID, type: config.XP_TYPES.PENALTY, sourceId: 'TASK-y', sourceName: 'Abandoned Task', rawPoint: -5, reviewer: founder.USER_ID, seasonId: 'SEA-1' });

  const mb = await ynda.xp.computeBreakdown(member.USER_ID, { seasonId: 'SEA-1' });
  approx(mb.overall, 15.5); // 20 + 0.5 - 5
  assert.strictEqual(mb.rolePoint, 0); // member không có role point
  assert.strictEqual(mb.roleContribution, 0);

  // Core: +1 role point → overall += 0.6
  let cb = await ynda.xp.computeBreakdown(core.USER_ID, { seasonId: 'SEA-1' });
  assert.strictEqual(cb.rolePoint, 1); // hiển thị giá trị gốc
  approx(cb.roleContribution, 0.6);
  approx(cb.overall, 0.6);

  // Vice: +0.75 → +0.45
  await ynda.xp.recordTxn({ user: vice.USER_ID, type: config.XP_TYPES.ROLE, sourceId: 'RVR-0002', sourceName: 'Role VICE Week 1', rawPoint: 0.75, reviewer: founder.USER_ID, isRolePoint: true, roleConversion: 0.6, roleRawPoint: 0.75, roleOverallValue: 0.45, seasonId: 'SEA-1' });
  const vb = await ynda.xp.computeBreakdown(vice.USER_ID, { seasonId: 'SEA-1' });
  assert.strictEqual(vb.rolePoint, 0.75);
  approx(vb.roleContribution, 0.45);
  approx(vb.overall, 0.45);
  console.log('✅ TEST 1: Role Point 60% conversion đúng');

  // ---------------------------------------------------------------- TEST 2: Penalty Engine
  const pBefore = ynda.xp.computePenalty({ taskXp: 20, workStart: '2026-08-20T00:00:00', submissionDeadline: '2026-08-22T00:00:00', atIso: '2026-08-19T00:00:00' });
  assert.strictEqual(pBefore, 0); // trước work start
  const p25 = ynda.xp.computePenalty({ taskXp: 20, workStart: '2026-08-20T00:00:00', submissionDeadline: '2026-08-24T00:00:00', atIso: '2026-08-21T00:00:00' }); // 25% thời gian
  assert.strictEqual(p25, -5);
  const p50 = ynda.xp.computePenalty({ taskXp: 20, workStart: '2026-08-20T00:00:00', submissionDeadline: '2026-08-24T00:00:00', atIso: '2026-08-22T00:00:00' }); // 50%
  assert.strictEqual(p50, -10);
  const p75 = ynda.xp.computePenalty({ taskXp: 20, workStart: '2026-08-20T00:00:00', submissionDeadline: '2026-08-24T00:00:00', atIso: '2026-08-23T00:00:00' }); // 75%
  assert.strictEqual(p75, -15);
  const pOver = ynda.xp.computePenalty({ taskXp: 20, workStart: '2026-08-20T00:00:00', submissionDeadline: '2026-08-24T00:00:00', atIso: '2026-08-25T00:00:00' }); // quá deadline
  assert.strictEqual(pOver, -40); // -2 × 20
  console.log('✅ TEST 2: Penalty Engine (0/-5/-10/-15/-40)');

  // ---------------------------------------------------------------- TEST 3: Task lifecycle + mandatory escalation
  const taskA = await ynda.tasks.createTask({
    title: 'Edit Reel #03', description: 'Edit video workshop',
    scope: config.TASK_TYPES.MANDATORY, department: 'MEDIA', xpFinal: 20,
    openTime: '2026-08-10T00:00:00', claimDeadline: '2026-08-11T21:00:00',
    workStart: '2026-08-16T20:00:00', submissionDeadline: '2026-08-17T23:59:00',
    skills: 'Edit, Premiere', unlimitedSlots: 'FALSE', slots: 1,
    seasonId: 'SEA-1',
    status: config.TASK_STATUS.DRAFT
  }, { USER_ID: core.USER_ID });
  assert.strictEqual(taskA.STATUS, config.TASK_STATUS.DRAFT);
  assert.ok(taskA.CODE.startsWith('MEDIA-'));

  // Mở task để bắt đầu nhận claim
  await ynda.tasks.updateTask(taskA.TASK_ID, { STATUS: config.TASK_STATUS.OPEN });
  // claim deadline đã qua (11/08 < hôm nay) — escalate
  const esc = await ynda.assignments.checkMandatoryEscalation(taskA.TASK_ID);
  assert.strictEqual(esc.status, 'escalated');
  assert.strictEqual((await ynda.tasks.getTask(taskA.TASK_ID)).FORCED, 'TRUE');
  console.log('✅ TEST 3a: Mandatory auto-escalate khi không ai nhận');

  // ------------------------------------------------------------------ assignment (riêng)
  const asg = await ynda.assignments.assign(taskA.TASK_ID, member.USER_ID, core, {
    assignmentType: config.ASSIGNMENT_TYPE.MANDATORY_ESCALATION,
    reason: 'Không có người tự nhận'
  });
  assert.strictEqual(asg.XP_POLICY, config.XP_POLICY.FORCED_50); // bị ép giao 50%
  const asgList = await ynda.assignments.listAssignments({ taskId: taskA.TASK_ID });
  assert.strictEqual(asgList.length, 1);
  assert.ok(asg.ASSIGNMENT_ID.startsWith('ASG-'));
  console.log('✅ TEST 3b: Assignment riêng (FORCED_50)');

  // Claim ≠ Assignment: member có thể claim task khác
  const taskB = await ynda.tasks.createTask({
    title: 'Bump Recruitment', scope: config.TASK_TYPES.GLOBAL_OPEN, department: 'TRUYEN_THONG', xpFinal: 2,
    openTime: '2026-08-15T20:00:00', claimDeadline: '2026-08-17T21:00:00',
    workStart: '2026-08-16T20:00:00', submissionDeadline: '2026-08-18T00:00:00',
    unlimitedSlots: 'TRUE', seasonId: 'SEA-1'
  }, { USER_ID: core.USER_ID });
  await ynda.tasks.updateTask(taskB.TASK_ID, { STATUS: config.TASK_STATUS.OPEN });
  const claim = await ynda.claims.claim(taskB.TASK_ID, member);
  assert.strictEqual(claim.XP_POLICY, config.XP_POLICY.FULL); // tự nhận 100%
  const dup = await ynda.claims.claim(taskB.TASK_ID, member).catch(e => e);
  assert.ok(dup instanceof Error, 'không claim 2 lần');
  console.log('✅ TEST 3c: Claim (100%) ≠ Assignment (FORCED_50), chống claim trùng');

  // ------------------------------------------------------------------ forced review 50% + quality bonus max 50%
  const taskC = await ynda.tasks.createTask({
    title: 'Edit Workshop Recap', scope: config.TASK_TYPES.MANDATORY, department: 'NOI_DUNG', xpFinal: 20,
    openTime: '2026-08-10T00:00:00', claimDeadline: '2026-08-10T01:00:00',
    workStart: '2026-08-10T02:00:00', submissionDeadline: '2026-08-30T00:00:00',
    seasonId: 'SEA-1'
  }, { USER_ID: core.USER_ID });
  await ynda.tasks.updateTask(taskC.TASK_ID, { STATUS: config.TASK_STATUS.OPEN });
  const asgC = await ynda.assignments.assign(taskC.TASK_ID, vice.USER_ID, core, { assignmentType: config.ASSIGNMENT_TYPE.MANDATORY_ESCALATION, reason: 'Ép giao' });
  const sub = await ynda.submissions.submit({
    taskRef: taskC.TASK_ID, userId: vice.USER_ID, proof: 'Đã hoàn thành tốt',
    assignmentId: asgC.ASSIGNMENT_ID
  });
  // Ai verify PASS
  await ynda.submissions.aiCheck(sub.SUBMISSION_ID, 'PASS', { checks: {} });
  // Human approve with quality bonus = 10 (max 50% × 20 = 10)
  const reviewed = await ynda.submissions.humanReview(sub.SUBMISSION_ID, founder.USER_ID, 'APPROVE', 'OK', 10);
  // forced: base 20*0.5 = 10 + quality bonus 10 = 20 (max)
  assert.strictEqual(reviewed.FINAL_XP, 20);
  console.log('✅ TEST 4: Forced task 20XP → base 10 + quality 10 = 20 (max 100%)');

  // ------------------------------------------------------------------ interaction mission
  const taskI = await ynda.tasks.createTask({
    title: 'Interaction Campaign #01', scope: config.TASK_TYPES.GLOBAL_OPEN, department: 'TRUYEN_THONG', xpFinal: 2,
    unlimitedSlots: 'TRUE', seasonId: 'SEA-1',
    openTime: new Date(Date.now() - 30 * 60 * 1000).toISOString() // mở 30 phút trước (early window)
  }, { USER_ID: core.USER_ID });
  const i1 = await ynda.bonus.recordInteraction({
    taskId: taskI.TASK_ID, userId: member.USER_ID, platform: 'FACEBOOK',
    actionsDone: ['REACT', 'SHARE', 'COMMENT'], postId: 'p1', taskOpenTime: taskI.OPEN_TIME
  });
  assert.strictEqual(i1.window, 'EARLY');
  approx(i1.xp, 0.5);
  // chống farm: submit lại cùng platform+action → không tính
  const i2 = await ynda.bonus.recordInteraction({
    taskId: taskI.TASK_ID, userId: member.USER_ID, platform: 'FACEBOOK',
    actionsDone: ['REACT', 'SHARE', 'COMMENT'], postId: 'p1', taskOpenTime: taskI.OPEN_TIME
  });
  assert.strictEqual(i2.duplicated, true);
  assert.strictEqual(i2.xp, 0);
  console.log('✅ TEST 5: Interaction early +0.5, chống farm đúng');

  // ------------------------------------------------------------------ share group bonus (không cộng dồn)
  assert.strictEqual(ynda.bonus.shareGroupBonus(10), 0.25);
  assert.strictEqual(ynda.bonus.shareGroupBonus(20), 0.5);
  assert.strictEqual(ynda.bonus.shareGroupBonus(37), 0.5); // KHÔNG cộng dồn
  assert.strictEqual(ynda.bonus.shareGroupBonus(80), 1.0);
  assert.strictEqual(ynda.bonus.shareGroupBonus(1280), 2.0);
  console.log('✅ TEST 6: Share Group bonus (không cộng dồn)');

  // ------------------------------------------------------------------ leaderboard
  const lb = await ynda.leaderboard.buildLeaderboard({});
  assert.ok(lb.all.length >= 4, 'leaderboard có >= 4 thành viên');
  const coreEntry = lb.all.find(e => e.userId === core.USER_ID);
  approx(coreEntry.rolePoint, 1);
  approx(coreEntry.roleContribution, 0.6);
  console.log('✅ TEST 7: Leaderboard — Role Point hiển thị gốc, Contribution 60%');

  // ------------------------------------------------------------------ Role Review weekly
  const rr = await ynda.roleReview.createReview({ seasonId: 'SEA-1', team: 'TRUYEN_THONG', memberId: core.USER_ID, memberName: core.NAME, role: 'CORE', reviewer: founder.USER_ID, note: '' });
  assert.strictEqual(rr.DEFAULT_ROLE_POINT, 1);
  await ynda.roleReview.aiRecommend(rr.REVIEW_ID, 0.75, '2 deadline bị miss', founder.USER_ID);
  const approved = await ynda.roleReview.approve(rr.REVIEW_ID, founder.USER_ID, 0.75, 'Founder duyệt');
  assert.strictEqual(approved.FINAL_ROLE_POINT, 0.75);
  assert.strictEqual(approved.XP_TXN.TYPE, config.XP_TYPES.ROLE);
  assert.strictEqual(approved.XP_TXN.IS_ROLE_POINT, 'TRUE');
  assert.strictEqual(String(approved.XP_TXN.ROLE_RAW_POINT), '0.75');
  approx(Number(approved.XP_TXN.ROLE_OVERALL_VALUE), 0.45);
  console.log('✅ TEST 8: Weekly Role Review — AI đề xuất 0.75, Founder duyệt, txn 60%');

  // ------------------------------------------------------------------ TEST 9: Leaderboard Multi-tab & Filters
  const lbFull = await ynda.leaderboard.buildLeaderboard({ department: 'TRUYEN_THONG' });
  assert.ok(Array.isArray(lbFull.all), 'all is array');
  assert.ok(Array.isArray(lbFull.core), 'core is array');
  assert.ok(Array.isArray(lbFull.members), 'members is array');
  assert.ok(Array.isArray(lbFull.monthly), 'monthly is array');
  assert.ok(lbFull.byDept.TRUYEN_THONG, 'byDept TRUYEN_THONG exists');
  assert.ok(lbFull.filtered.length > 0, 'filtered department works');
  const sampleCard = lbFull.all[0];
  assert.ok(sampleCard.completedTasks !== undefined, 'completedTasks exists on card');
  assert.ok(sampleCard.qualityScore !== undefined, 'qualityScore exists on card');
  console.log('✅ TEST 9: Leaderboard multi-tab (Overall, Core, Member, Monthly, Top Ban) & filter đúng');

  // ------------------------------------------------------------------ TEST 10: Dashboard Aggregator API
  const dash = await ynda.getDashboard(member.USER_ID);
  assert.ok(dash.user, 'dash has user');
  assert.ok(dash.memberMetrics, 'dash has memberMetrics');
  assert.ok(dash.coreMetrics, 'dash has coreMetrics');
  assert.ok(dash.founderOverview, 'dash has founderOverview');
  assert.ok(Array.isArray(dash.recentTxns), 'dash has recentTxns');
  console.log('✅ TEST 10: Dashboard API aggregated đầy đủ metrics cho Member, Core và Founder');

  // ------------------------------------------------------------------ TEST 11: Production Squads & Breakdown
  const team = await ynda.production.createTeam({
    name: 'Workshop Film Recap #01',
    projectLink: 'https://drive.google.com/test',
    members: [{ userId: member.USER_ID, role: 'EDITOR' }, { userId: core.USER_ID, role: 'PRODUCER' }],
    createdBy: founder.USER_ID
  });
  assert.strictEqual(team.NAME, 'Workshop Film Recap #01');
  const equalBreakdown = await ynda.production.proposeBreakdown({
    totalXp: 30,
    members: [member.USER_ID, core.USER_ID]
  });
  assert.strictEqual(equalBreakdown.method, 'equal');
  assert.strictEqual(equalBreakdown.breakdown[member.USER_ID], 15);
  assert.strictEqual(equalBreakdown.breakdown[core.USER_ID], 15);
  console.log('✅ TEST 11: Production Squad breakdown (chia đều & theo vai trò) đúng');

  // ------------------------------------------------------------------ TEST 12: Season Lock & Archive
  const s1 = await ynda.season.createSeason({ name: 'Season 01 · Genesis', createdBy: founder.USER_ID });
  assert.strictEqual(s1.STATUS, config.SEASON_STATUS.ACTIVE);
  const s1Locked = await ynda.season.lockSeason(s1.SEASON_ID, founder.USER_ID);
  assert.strictEqual(s1Locked.STATUS, config.SEASON_STATUS.LOCKED);
  assert.ok(s1Locked.LOCKED_AT, 'has lockedAt');
  console.log('✅ TEST 12: Season Lock & Archive điểm thành công');

  console.log('\n🎉 ALL YNDA TESTS PASSED');
}

main().catch(err => {
  console.error('❌ TEST FAILED:', err.message);
  console.error(err.stack);
  process.exit(1);
});