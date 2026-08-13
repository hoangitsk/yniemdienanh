'use strict';

// =============================================================================
// YNDA OPERATIONS — SYSTEM CONFIGURATION (single source of truth for rules)
// Toàn bộ hằng số luật hệ thống nằm ở đây. Không rút gọn luật ở nơi khác.
// =============================================================================

const ROLES = {
  FOUNDER: 'FOUNDER',
  PRESIDENT: 'PRESIDENT',
  CO_FOUNDER: 'CO_FOUNDER',
  CORE_FOUNDER: 'CORE_FOUNDER',
  CORE: 'CORE',
  VICE: 'VICE',
  MEMBER: 'MEMBER'
};

// BĐH = Founder/President/Co-Founder/Core Founder (toàn quyền)
const EXECUTIVE_ROLES = new Set([
  ROLES.FOUNDER, ROLES.PRESIDENT, ROLES.CO_FOUNDER, ROLES.CORE_FOUNDER
]);

const ROLE_ORDER = [
  ROLES.FOUNDER, ROLES.PRESIDENT, ROLES.CO_FOUNDER, ROLES.CORE_FOUNDER,
  ROLES.CORE, ROLES.VICE, ROLES.MEMBER
];

// =============================================================================
// BAN / DEPARTMENT — khớp với Google Drive architecture (TASKS/<BAN>)
// =============================================================================
const DEPARTMENTS = [
  'GLOBAL',
  'DUYET_BAI',      // Ban Duyệt bài
  'MEDIA',          // Ban Media
  'NOI_DUNG',       // Ban Nội dung
  'NHAN_SU',        // Ban Nhân sự
  'TRUYEN_THONG'    // Ban Truyền thông
];

const DEPARTMENT_LABELS = {
  GLOBAL: 'GLOBAL',
  DUYET_BAI: 'DUYỆT BÀI',
  MEDIA: 'MEDIA',
  NOI_DUNG: 'NỘI DUNG',
  NHAN_SU: 'NHÂN SỰ',
  TRUYEN_THONG: 'TRUYỀN THÔNG'
};

const DEPARTMENT_PREFIX = {
  GLOBAL: 'GLO',
  DUYET_BAI: 'DBAI',
  MEDIA: 'MEDIA',
  NOI_DUNG: 'ND',
  NHAN_SU: 'NS',
  TRUYEN_THONG: 'TRU'
};

// =============================================================================
// TASK SCOPE / TYPE
// =============================================================================
const TASK_SCOPES = ['GLOBAL', 'DEPARTMENT', 'MANDATORY'];

// Ba loại task: GLOBAL OPEN, DEPARTMENT OPEN, MANDATORY
const TASK_TYPES = {
  GLOBAL_OPEN: 'GLOBAL_OPEN',
  DEPARTMENT_OPEN: 'DEPARTMENT_OPEN',
  MANDATORY: 'MANDATORY'
};

// =============================================================================
// TASK LIFECYCLE (XI. TASK LIFECYCLE)
// =============================================================================
const TASK_STATUS = {
  DRAFT: 'DRAFT',
  AI_ANALYSIS: 'AI_ANALYSIS',
  APPROVED: 'APPROVED',
  SCHEDULED: 'SCHEDULED',
  OPEN: 'OPEN',
  CLAIMED: 'CLAIMED',
  ASSIGNED: 'ASSIGNED',
  ACTIVE: 'ACTIVE',
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
  AI_CHECK: 'AI_CHECK',
  NEEDS_REVISION: 'NEEDS_REVISION',
  HUMAN_REVIEW: 'HUMAN_REVIEW',
  APPROVED: 'APPROVED',
  XP_CREDITED: 'XP_CREDITED',
  REJECTED: 'REJECTED',
  ARCHIVED: 'ARCHIVED',
  COMPLETED: 'COMPLETED'
};

const TASK_STATUS_FLOW = [
  TASK_STATUS.DRAFT,
  TASK_STATUS.AI_ANALYSIS,
  TASK_STATUS.APPROVED,
  TASK_STATUS.SCHEDULED,
  TASK_STATUS.OPEN,
  TASK_STATUS.IN_PROGRESS,
  TASK_STATUS.SUBMITTED,
  TASK_STATUS.AI_CHECK,
  TASK_STATUS.HUMAN_REVIEW,
  TASK_STATUS.APPROVED,
  TASK_STATUS.XP_CREDITED
];

// =============================================================================
// CLAIM / ASSIGNMENT / SUBMISSION STATUS
// =============================================================================
const CLAIM_STATUS = {
  CLAIMED: 'CLAIMED',
  ACTIVE: 'ACTIVE',
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
  COMPLETED: 'COMPLETED',
  RELEASED: 'RELEASED',
  ABANDONED: 'ABANDONED',
  PENALIZED: 'PENALIZED'
};

// Assignment là cơ chế RIÊNG (VIII). Không đồng nhất với Claim/Mandatory/Task Type.
const ASSIGNMENT_TYPE = {
  VOLUNTARY: 'VOLUNTARY',
  DIRECT: 'DIRECT',
  MANDATORY_ESCALATION: 'MANDATORY_ESCALATION'
};

const ASSIGNMENT_STATUS = {
  ASSIGNED: 'ASSIGNED',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  STARTED: 'STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
  COMPLETED: 'COMPLETED',
  RELEASED: 'RELEASED',
  ABANDONED: 'ABANDONED',
  EXPIRED: 'EXPIRED'
};

const XP_POLICY = {
  FULL: 'FULL',                 // tự nhận: tối đa 100% XP
  FORCED_50: 'FORCED_50'        // ép giao: 50% Base XP + Quality Bonus tối đa 50%
};

const SUBMISSION_STATUS = {
  SUBMITTED: 'SUBMITTED',
  AI_CHECK: 'AI_CHECK',
  PASS: 'PASS',
  NEEDS_REVISION: 'NEEDS_REVISION',
  SUSPICIOUS: 'SUSPICIOUS',
  INVALID: 'INVALID',
  HUMAN_REVIEW: 'HUMAN_REVIEW',
  APPROVED: 'APPROVED',
  RETURNED: 'RETURNED',
  REJECTED: 'REJECTED'
};

// =============================================================================
// AI VERIFICATION OUTPUT (XXI)
// =============================================================================
const AI_VERDICTS = ['PASS', 'NEEDS_REVISION', 'SUSPICIOUS', 'INVALID'];

const HUMAN_REVIEW_ACTIONS = ['APPROVE', 'RETURN', 'REJECT'];

// =============================================================================
// DEADLINE ENGINE (XII) — 4 mốc khác nhau
// =============================================================================
const DEADLINE_FIELDS = ['openTime', 'claimDeadline', 'workStart', 'submissionDeadline'];

// =============================================================================
// PENALTY ENGINE (XIII)
//   Trước Work Start: không penalty.
//   Sau Work Start: penalty = Task XP × Progress Time %
//   Quá deadline: penalty = -2 × Task XP
//   XP có thể âm.
// =============================================================================
const PENALTY = {
  BEFORE_WORK_START: 0,
  OVERDEADLINE_MULTIPLIER: 2,
  xpAtProgress(taskXp, progressPct) {
    const pct = Math.max(0, Math.min(1, progressPct));
    return -Math.round(taskXp * pct * 100) / 100;
  },
  xpOverdeadline(taskXp) {
    return -2 * taskXp;
  }
};

// =============================================================================
// XP SCALE CHUẨN (XXIX) — thang XP duy nhất hiện tại
// =============================================================================
const XP_SCALE = [
  { id: 'M0', label: 'Micro', value: 0.25 },
  { id: 'M1', label: 'Small', value: 0.5 },
  { id: 'M2', label: 'Standard', value: 1 },
  { id: 'M3', label: 'Medium', value: 1.5 },
  { id: 'M4', label: 'Large', value: 2 },
  { id: 'M5', label: 'Major', value: 3 },
  { id: 'M6', label: 'Super Large', value: 5 },
  { id: 'M7', label: 'Critical', value: 10 } // không khóa trần
];

const DIFFICULTY_IDS = XP_SCALE.map(s => s.id);

// =============================================================================
// OVERALL (IV)
//   MEMBER: Task XP + Bonus XP - Penalty XP
//   CORE/VICE: Task XP + Bonus XP - Penalty XP + Role Contribution
//   Role Contribution = Role Point × 60%
// =============================================================================
const ROLE = {
  DEFAULT_WEEKLY: { CORE: 1, VICE: 0.75 },
  CONVERSION: 0.60,
  ROLE_60_PERCENT: true
};

// =============================================================================
// XP LEDGER — transaction types (XLI)
// =============================================================================
const XP_TYPES = {
  TASK: 'TASK',               // Task XP
  INTERACTION: 'INTERACTION', // Interaction Mission
  BONUS: 'BONUS',             // Bonus XP (Contribution / Share Group / Production bonus)
  PENALTY: 'PENALTY',         // Penalty XP
  ROLE: 'ROLE'                // Role Point (quy đổi 60%)
};

const TXN_STATUS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  APPLIED: 'Applied',
  REJECTED: 'Rejected'
};

// =============================================================================
// INTERACTION MISSION (XV, XVI, XVII)
// =============================================================================
const INTERACTION = {
  PLATFORMS: ['FACEBOOK', 'TIKTOK', 'THREADS', 'INSTAGRAM'],
  ACTIONS: ['REACT', 'SHARE', 'COMMENT'],
  EARLY_WINDOW_HOURS: 1,
  LATE_WINDOW_HOURS: 24,
  EARLY_XP_PER_PLATFORM: 0.5,
  LATE_XP_PER_PLATFORM: 0.25
};

// =============================================================================
// SHARE GROUP — BONUS XP (XVIII, XIX, XX)
//   10 → +0.25, 20 → +0.50 ... cứ gấp đôi group tăng 0.25. KHÔNG cộng dồn.
// =============================================================================
const SHARE_GROUP = {
  BASE_GROUP_COUNT: 10,
  BASE_BONUS: 0.25,
  BONUS(validGroupCount) {
    if (validGroupCount < this.BASE_GROUP_COUNT) return 0;
    const doublings = Math.floor(Math.log2(validGroupCount / this.BASE_GROUP_COUNT));
    return Math.round((this.BASE_BONUS + this.BASE_BONUS * doublings) * 100) / 100;
  }
};

// =============================================================================
// SEASON (XXXIX, XL)
// =============================================================================
const SEASON_STATUS = {
  PLANNING: 'PLANNING',
  ACTIVE: 'ACTIVE',
  LOCKED: 'LOCKED',
  ARCHIVED: 'ARCHIVED'
};

const RECOGNITION = {
  TOP_OVERALL: 8,
  SPECIAL_SELECTION: 3
};

// =============================================================================
// PRODUCTION (XXV, XXVI, XXVII)
// =============================================================================
const PRODUCTION_ROLES = [
  'PRODUCER',
  'DIRECTOR',
  'CINEMATOGRAPHER',
  'ACTOR',
  'EDITOR',
  'LIGHTING',
  'SOUND',
  'ART',
  'ASSISTANT'
];

// =============================================================================
// MESSENGER EVENTS (XLIV)
// =============================================================================
const MESSENGER_EVENTS = [
  'TASK_OPENED',
  'TASK_ENDING',
  'TASK_PENALTY_WINDOW',
  'TASK_ASSIGNED',
  'PROOF_RETURNED',
  'PROOF_APPROVED',
  'RANK_CHANGED'
];

// =============================================================================
// AUDIT ACTIONS (XLVII)
// =============================================================================
const AUDIT_ACTIONS = [
  'CREATE_TASK', 'EDIT_TASK', 'EDIT_XP', 'XP_OVERRIDE', 'ASSIGNMENT',
  'CLAIM', 'SUBMISSION', 'REVISION', 'APPROVE', 'REJECT', 'ROLE_REVIEW',
  'ROLE_POINT_CHANGE', 'PENALTY', 'EXTEND_DEADLINE', 'ARCHIVE', 'DELETE'
];

// =============================================================================
// Permission matrix (XXIV)
// =============================================================================
// FOUNDER/PRESIDENT/CO_FOUNDER/CORE_FOUNDER: toàn quyền.
// CORE: tạo task, quản lý task phạm vi được giao, duyệt proof, gia hạn task được phép,
//       giao task, review member. Báo cáo BĐH với quyết định quan trọng.
// VICE: thực thi quản lý, hỗ trợ Core, review/moderate khi được cấp quyền.
// MEMBER: view, claim, start, submit proof, request revision.
const PERMISSIONS = {
  task: {
    // MEMBER: View, Claim, Start, Submit Proof, Request Revision (XXIV)
    view: ['MEMBER'],
    claim: ['MEMBER'],
    start: ['MEMBER'],
    submit: ['MEMBER'],
    release: ['MEMBER'],
    respond: ['MEMBER'],
    // CORE (báo cáo BĐH với quyết định quan trọng)
    create: ['EXEC', 'CORE'],
    edit: ['EXEC', 'CORE'],
    delete: ['EXEC'],
    archive: ['EXEC', 'CORE'],
    setDeadlines: ['EXEC', 'CORE'],
    overrideXp: ['EXEC', 'CORE'],
    extendDeadline: ['EXEC', 'CORE'],
    approveTask: ['EXEC', 'CORE'],
    reviewProof: ['EXEC', 'CORE'],
    assign: ['EXEC', 'CORE'],
    reviewMember: ['EXEC', 'CORE'],
    audit: ['CORE']
  },
  roleReview: {
    create: ['EXEC'],
    approve: ['EXEC'],
    edit: ['EXEC']
  },
  bonus: {
    create: ['EXEC'],
    approve: ['EXEC']
  },
  production: {
    create: ['EXEC', 'CORE'],
    edit: ['EXEC', 'CORE']
  },
  season: {
    manage: ['EXEC']
  },
  settings: {
    manage: ['EXEC']
  }
};

// =============================================================================
// Helpers
// =============================================================================
function nowIso() {
  return new Date().toISOString();
}

function isExecutive(role) {
  return EXECUTIVE_ROLES.has(String(role || '').toUpperCase());
}

function normalizeRole(role) {
  const r = String(role || '').toUpperCase().trim();
  return ROLE_ORDER.includes(r) ? r : ROLES.MEMBER;
}

function can(actorRole, category, action) {
  const allowed = (PERMISSIONS[category] && PERMISSIONS[category][action]) || [];
  const role = normalizeRole(actorRole);
  if (allowed.includes('EXEC') && isExecutive(role)) return true;
  if (allowed.includes('CORE')) return role === ROLES.CORE || role === ROLES.VICE || isExecutive(role);
  if (allowed.includes('MEMBER')) return true;
  return false;
}

module.exports = {
  ROLES,
  EXECUTIVE_ROLES,
  ROLE_ORDER,
  DEPARTMENTS,
  DEPARTMENT_LABELS,
  DEPARTMENT_PREFIX,
  TASK_SCOPES,
  TASK_TYPES,
  TASK_STATUS,
  TASK_STATUS_FLOW,
  CLAIM_STATUS,
  ASSIGNMENT_TYPE,
  ASSIGNMENT_STATUS,
  XP_POLICY,
  SUBMISSION_STATUS,
  AI_VERDICTS,
  HUMAN_REVIEW_ACTIONS,
  DEADLINE_FIELDS,
  PENALTY,
  XP_SCALE,
  DIFFICULTY_IDS,
  ROLE,
  XP_TYPES,
  TXN_STATUS,
  INTERACTION,
  SHARE_GROUP,
  SEASON_STATUS,
  RECOGNITION,
  PRODUCTION_ROLES,
  MESSENGER_EVENTS,
  AUDIT_ACTIONS,
  PERMISSIONS,
  nowIso,
  isExecutive,
  normalizeRole,
  can
};
