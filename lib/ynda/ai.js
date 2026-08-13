'use strict';

// =============================================================================
// YNDA AI VERIFICATION ENGINE (XXI, XXIII, XLIII)
// -----------------------------------------------------------------------------
// AI chỉ làm Verification: phân tích → xác minh → đề xuất. AI KHÔNG được
// quyết định cuối cùng, không cộng XP, không duyệt submission cuối, không
// quyết Role Point cuối, không tự tạo Bonus.
// =============================================================================

const config = require('./config');

const CHECKLIST = [
  'proof tồn tại',
  'proof đúng Task',
  'proof đúng nền tảng',
  'proof đúng hành động',
  'proof đủ số lượng',
  'proof không trùng với submission cũ',
  'không có dấu hiệu bất thường',
  'proof đúng format yêu cầu'
];

// -----------------------------------------------------------------------------
// AI VERIFY PROOF — sử dụng Gemini khi có key; nếu không, dùng deterministic
// heuristic analyzer để không chặn toàn hệ thống khi thiếu Gemini.
// =============================================================================
async function verifyProof({ task, submission, claimsUser, gemini }) {
  // Task yêu cầu AI verify?
  const aiVerify = String(task.AI_VERIFY || 'YES').toUpperCase();
  if (aiVerify !== 'YES') {
    return { verdict: 'PASS', report: { aiVerify: 'NO', note: 'Task không yêu cầu AI verify.' }, applied: true };
  }

  const payload = {
    taskCode: task.CODE,
    title: task.TITLE,
    scope: task.SCOPE,
    requiredPlatform: task.SKILLS || '',
    proofRequirement: task.PROOF_REQUIREMENT || '',
    proofFormat: task.PROOF_FORMAT || '',
    proof: submission.PROOF || '',
    proofFiles: submission.PROOF_FILES || '',
    previousVersions: submission.VERSION
  };

  // 1) Thử Gemini nếu khả dụng
  if (gemini && typeof gemini === 'function') {
    try {
      const prompt = `Bạn là hệ thống xác minh bằng chứng (proof) của nền tảng quản lý nhiệm vụ YNDA.
Nhiệm vụ: ${task.CODE} — ${task.TITLE}
Scope: ${task.SCOPE}
Yêu cầu proof: ${task.PROOF_REQUIREMENT || 'Không rõ'}
Format proof: ${task.PROOF_FORMAT || 'Không rõ'}
Nền tảng/kỹ năng: ${task.SKILLS || 'Không rõ'}

Proof người dùng cung cấp:
- Mô tả: ${submission.PROOF || '(trống)'}
- Files đính kèm: ${submission.PROOF_FILES || '(trống)'}
- Version: ${submission.VERSION}

Hãy kiểm tra theo checklist:
1. Proof có tồn tại không?
2. Có đúng Task không?
3. Có đúng nền tảng không?
4. Có đúng hành động không?
5. Có đủ số lượng không?
6. Có trùng proof với submission cũ không?
7. Có dấu hiệu bất thường không?
8. Có đúng format yêu cầu không?

Trả về JSON thuần (không markdown) với cấu trúc:
{
  "verdict": "PASS | NEEDS_REVISION | SUSPICIOUS | INVALID",
  "report": { "checks": {...}, "missing": [...], "reason": "..." },
  "recommended": true
}
Quy tắc: AI chỉ xác minh, KHÔNG cộng điểm. Nghi ngờ farm/spam -> SUSPICIOUS.`;
      const { data } = await gemini(prompt);
      const verdict = String(data.verdict || 'PASS').toUpperCase();
      if (config.AI_VERDICTS.includes(verdict)) {
        return { verdict, report: data.report || data.reason || data, applied: true };
      }
    } catch (e) {
      // fallback heuristic nếu Gemini lỗi
      config.DEBUG_AI_FALLBACK = e.message || 'AI fallback';
    }
  }

  // 2) Heuristic deterministic fallback
  return heuristicVerify(payload);
}

function heuristicVerify({ proof, proofFiles, proofRequirement, proofFormat }) {
  const missing = [];
  const hasProofText = String(proof || '').trim().length > 0;
  const hasFiles = String(proofFiles || '').trim().length > 0;

  if (!hasProofText && !hasFiles) missing.push('Không có proof mô tả hoặc file đính kèm');
  if (proofRequirement && !hasProofText) missing.push('Thiếu proof theo yêu cầu: ' + proofRequirement);

  if (missing.length === 0) {
    return { verdict: 'PASS', report: { checks: { existence: true }, missing: [], reason: 'Proof hợp lệ theo heuristic.' } };
  }
  const allMissing = missing.length >= (proofRequirement ? 1 : 1);
  return {
    verdict: 'NEEDS_REVISION',
    report: { checks: {}, missing, reason: missing.join('; ') }
  };
}

// -----------------------------------------------------------------------------
// XXIII — AI CHẤM ĐỘ KHÓ TASK: đề xuất Difficulty + XP + Estimated Time
// + Proof Requirement. Creator được sửa XP kèm Reason for Override.
// =============================================================================
async function analyzeTask(task, gemini) {
  const payload = {
    title: task.TITLE,
    description: task.DESCRIPTION,
    expectedOutput: task.EXPECTED_OUTPUT,
    skills: task.SKILLS,
    steps: task.STEPS,
    teamSize: task.IS_TEAM_TASK === 'TRUE' ? (task.TOTAL_XP || 'team') : 1
  };

  if (gemini && typeof gemini === 'function') {
    try {
      const prompt = `Bạn là trợ lý phân tích độ khó nhiệm vụ của nền tảng YNDA.
Dữ liệu task:
${JSON.stringify(payload, null, 2)}

Phân tích các khía cạnh: Time, Complexity, Skill, Responsibility, Impact, Urgency.
Sau đó đề xuất:
- difficulty: một trong [${config.DIFFICULTY_IDS.join(', ')}]
- xp: số XP đề xuất (số thực)
- estimatedTimeMin: thời gian ước tính (phút)
- proofRequirement: loại proof phù hợp (VD: Screenshot, Video, File, Link, Text)

THANG XP CHUẨN YNDA (duy nhất, không dùng thang cũ):
${config.XP_SCALE.map(s => `${s.id} ${s.label} = ${s.value}`).join('\n')}
M7 không khóa trần; task cực lớn có thể 15-20 XP nếu cần.

Trả về JSON thuần (không markdown):
{ "difficulty": "...", "xp": 0, "estimatedTimeMin": 0, "proofRequirement": "...", "reasoning": "..." }
AI CHỈ ĐỀ XUẤT, con người quyết định đánh giá cuối.`;
      const { data } = await gemini(prompt);
      return {
        difficulty: data.difficulty || 'M2',
        xp: Number(data.xp) || 0,
        estimatedTimeMin: Number(data.estimatedTimeMin) || 0,
        proofRequirement: data.proofRequirement || '',
        reasoning: data.reasoning || ''
      };
    } catch (e) {
      config.DEBUG_AI_FALLBACK = e.message || 'AI analysis fallback';
    }
  }

  return heuristicDifficulty(payload);
}

function heuristicDifficulty({ teamSize }) {
  const isTeam = Number(teamSize && teamSize > 1);
  const base = isTeam ? config.XP_SCALE[5].value : config.XP_SCALE[3].value;
  return {
    difficulty: isTeam ? 'M5' : 'M3',
    xp: base,
    estimatedTimeMin: isTeam ? 300 : 60,
    proofRequirement: 'File / Screenshot / Link',
    reasoning: 'AI không khả dụng, dùng heuristic mặc định.'
  };
}

// -----------------------------------------------------------------------------
// XLIII — AI CHẤM ROLE REVIEW (VI): AI chỉ đề xuất, Founder quyết định cuối
// =============================================================================
async function recommendRolePoint({ team, role, weekData, gemini }) {
  const defaultPoint = config.ROLE.DEFAULT_WEEKLY[role] || 0;

  if (gemini && typeof gemini === 'function') {
    try {
      const prompt = `Bạn là trợ lý đề xuất Role Point hàng tuần cho ${role} của team ${team} (nền tảng YNDA).
Role Point mặc định: +${defaultPoint}/tuần.
Dữ liệu hoạt động tuần:
${JSON.stringify(weekData || {}, null, 2)}

Đánh giá rồi ĐỀ XUẤT (không quyết định):
- recommended: số Role Point đề xuất (số thực)
- reason: ngắn gọn dựa trên dữ liệu. VD: "2 deadline bị miss, 1 task phải nhắc nhiều lần."
Trả về JSON thuần: { "recommended": 0, "reason": "..." }
AI CHỈ ĐỀ XUẤT; Founder là người duyệt cuối.`;
      const { data } = await gemini(prompt);
      return {
        recommended: Number(data.recommended) || defaultPoint,
        reason: data.reason || '',
        default: defaultPoint
      };
    } catch (e) {}
  }
  return { recommended: defaultPoint, reason: 'Không có dữ liệu bất thường.', default: defaultPoint };
}

module.exports = { verifyProof, analyzeTask, recommendRolePoint, heuristicVerify, CHECKLIST };