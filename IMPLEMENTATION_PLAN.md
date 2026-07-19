# IMPLEMENTATION PLAN — ưu tiên theo batch

## Quyết định và giả định trước khi triển khai

- Firestore là nguồn sự thật; RTDB user/email mirror là legacy, ngừng ghi và khóa rules.
- Không paid-vote. Audience Choice chỉ một tài khoản đã xác minh cho mỗi tác phẩm; vote do server tạo.
- Role/permission/amount/status/score/result/certificate là server-authoritative.
- Không xóa dữ liệu hiện có. Migration chỉ thêm field/record hoặc khóa đường ghi; backup và rollback trước khi chạy production.
- Worktree ban đầu có thay đổi chưa commit ở schedule/dashboard/permissions; mọi batch phải giữ và tự review diff.

## Trạng thái thực hiện ngày 2026-07-19

| Batch | Trạng thái | Bằng chứng hoàn thành | Việc còn lại / deployment gate |
|---|---|---|---|
| P0-A — rules/credential | Hoàn tất code, chưa hoàn tất production | Firestore dùng Auth claim và allowlist profile; Storage owner/type/size; RTDB deny-all; có `firebase.json`, `.firebaserc`, `database.rules.json`; RTDB client sync đã dừng | Firebase CLI chưa đăng nhập và máy không có Java nên chưa compile/emulator/deploy rules. Phải deploy rồi chạy allow/deny test. Credential InfinityFree cũ vẫn phải rotate/vô hiệu hóa; các script này chỉ là legacy, không phải production blocker Vercel. |
| P0-B — auth/certificate/abuse/Vercel | Hoàn tất code; bản P0 chính đã Ready và health production đạt | Content POST bị vô hiệu hóa, generate-certificate cũ trả 410, verify certificate đọc backend canonical, Turnstile/sync fail closed, grant role giới hạn, unknown API trả JSON 404; alias chính đang ở `dpl_GCmkDWSEYDWZfWzYSPfLSBPe7U66`, `/api/health` trả JSON | Bản bổ sung Core/Founder `dpl_EqEF3aoNsTiLixPJVcQPLDo76fyv` còn `UNKNOWN`, chưa gắn alias. Không coi Firebase rules đã deploy theo Vercel. |
| P0-C — payment/vote | Hoàn tất code review + syntax/route smoke; chưa có PayOS/Firebase integration test thật | Vote transaction theo UID; paid-vote 410; payment amount/target từ server; deterministic intent; webhook/poll dùng một fulfillment transaction; deterministic marker/entitlement; orphan payment có recovery từ intent; client không ghi transaction | Cần PayOS sandbox/webhook replay + hai request đồng thời với Firestore thật. Không tự động hoàn tiền order thanh toán trùng lịch sử. |
| P1-A/P1-B | Một phần thay đổi đã có trong worktree, không mở rộng batch | Syntax toàn repo qua; route schedule load local | Chưa đủ test state machine end-to-end, email/Meet failure và rules integration. Không đánh dấu hoàn tất. |
| P2/P3 | Ngoài phạm vi lượt này | Không redesign, không nâng dependency | `npm audit` còn 11 advisory; xử lý bằng batch nâng cấp tương thích riêng. |

### Thứ tự bắt buộc trước lần release tiếp theo

1. Đăng nhập Firebase CLI, compile/deploy ba bộ rules và chạy test allow/deny bằng tài khoản anonymous/member/manager/admin.
2. Chạy PayOS sandbox: duplicate click, webhook replay, polling đồng thời, amount mismatch và recovery sau lỗi giữa chừng.
3. Xác nhận Vercel deployment Ready, alias chính và smoke các route/API production.
4. Chỉ sau ba gate trên mới chuyển sang P1; không mở P2/P3 trong batch này.

## Batch P0-A — Credential, rules và deployment drift

**Mục tiêu:** đóng các cửa lộ dữ liệu/takeover trước khi sửa UX.

- **Vấn đề xử lý:** FTP secret tracked; Storage wildcard; Firestore signedIn/profile escalation; RTDB public/legacy; production rules drift.
- **File dự kiến:** `storage.rules`, `firestore.rules`, `database.rules.json` (mới), `firebase.json`/`.firebaserc` (mới nếu phù hợp), `upload_infinityfree.py`, `upload_infinityfree_curl.bat`, ba HTML (ngừng RTDB sync), `.env.example`, tài liệu deploy.
- **Database/API liên quan:** Firebase Auth/Firestore/Storage/RTDB; không đổi collection hiện có, chỉ deny đường ghi mới và thêm allowlist.
- **Hành vi hiện tại:** wildcard/public hoặc profile client có thể cấp quyền; helper dùng password plaintext.
- **Hành vi mong muốn:** deny-by-default; avatar owner-only, type/size; token Auth là nguồn xác minh; helper lấy env/prompt và fail closed.
- **Trường hợp biên:** user cũ thiếu `projectGroup`; avatar cũ vẫn đọc được nếu policy cho phép; offline app không ghi RTDB; deployed rules khác repo.
- **Regression risk:** form profile/Google completion có thể bị reject khi gửi field privileged; cần bỏ các field đó ở client trước deploy.
- **Migration:** export rules/data, rotate FTP credential và Firebase/RTDB access nếu cần; không purge dữ liệu trong batch; giữ backup.
- **Backward compatibility:** đọc field legacy vẫn cho UI; không cho client sửa role/dept; `projectGroup` thiếu được coi là community/legacy theo policy.
- **Rollback:** giữ bản rules cũ trong artifact/backup; code rollback không khôi phục secret; mở lại từng path chỉ sau incident review.
- **Test:** Firebase Rules emulator/REST deny tests; Storage owner/non-owner/type/size; grep secret; client smoke profile/avatar; deploy diff check.
- **Tiêu chí hoàn thành:** không còn wildcard write/RTDB public; tracked secret = 0; unauthorized profile escalation bị từ chối; actual deployed rules hash khớp repo.
- **Ngoài phạm vi:** xóa dữ liệu RTDB/đổi Firebase project, rewrite Git history (chỉ hướng dẫn Founder).

## Batch P0-B — Server authorization, content, certificate và abuse controls

- **Mục tiêu:** mọi endpoint nhạy cảm fail closed và không tin client ở content/certificate/sync.
- **Vấn đề:** homepage unauth + git push, certificate forgery, Turnstile dev bypass, sync key trống, admin grant policy, missing service-account preflight.
- **File dự kiến:** `index.js`, `api/verify-turnstile.js`, `api/config.js`, `api/admin/upsert-user.js`, `api/admin/delete-user.js`, `vercel.json`, client content calls.
- **Database/API:** Auth/Firestore, file content, social API, Vercel route contract.
- **Hiện tại → mong muốn:** public write/side effect → authenticated manager + no shell; missing secret success → production 503; arbitrary certificate → canonical/admin-only or disabled; role grant → Admin/Founder only.
- **Biên:** local development explicit opt-in; Vercel read-only FS; token expired; unknown `/api` returns JSON 404.
- **Regression risk:** content editor and local smoke need real Firebase env; direct Vercel functions must duplicate auth.
- **Migration/compat:** preserve existing `homepage-content.json`/Firestore content; no auto commit; mark old forged certificate endpoint unsupported.
- **Rollback:** feature flag `ALLOW_LOCAL_CONTENT_WRITE` off by default; revert route guard without restoring shell execution.
- **Test:** endpoint matrix unauth/expired/member/manager/admin; malformed bodies; production env missing secrets; route contract.
- **Done:** no unauth side effect, no arbitrary certificate, no fail-open CAPTCHA/key, role policy tests pass.
- **Ngoài phạm vi:** full CSP rewrite, email provider migration.

## Batch P0-C — Payment and voting integrity

- **Mục tiêu:** server-authoritative money/votes with idempotency and no paid-vote.
- **Vấn đề:** client amount/redirect, duplicate order, concurrent fulfillment, public status oracle, paid-vote legacy, client vote paths/local counters.
- **File dự kiến:** `api/create-payment.js`, `api/payment-status.js`, `api/payos-webhook.js`, `lib/paymentFulfillment.js`, new `api/cast-vote.js`, `index.js`, `firestore.rules`, `index.html`, `dashboard.html`, `community.html`, `terms.html`.
- **Database/API:** `transactions`, `registrations`, `submissions`, `certificates`, `budget`, `config/prizePool`, `submissions/{id}/votes/{uid}`.
- **Hiện tại → mong muốn:** PayOS proxy/client-ledger → intent/order computed server; vote client/IP/paid → verified account + deterministic server write.
- **Biên:** webhook replay, status polling + webhook đồng thời, wrong amount, PayOS outage, duplicate tab, historical paid-vote records.
- **Regression risk:** existing pending orders and legacy vote data; new endpoint must be deployed before disabling old UI.
- **Migration:** label historical vote transactions `legacy_no_entitlement`; backup/reconcile; no deletion; freeze paid-vote CTA.
- **Rollback:** kill switch for new vote/payment creation; never reverse confirmed ledger; preserve webhook/status read-only reconciliation.
- **Test:** unit transaction mocks; two concurrent fulfill calls; amount/type/host tampering; vote duplicate/rules; reload/offline; PayOS webhook signature/replay.
- **Done:** paid-vote create returns 410; amount mismatch=0; fulfillment idempotent; one vote/user/work; client cannot confirm money.
- **Ngoài phạm vi:** refund automation/legal tax policy.

## Batch P1-A — Schedule and recruitment state machine

- **Mục tiêu:** interview flow end-to-end without IDOR/race/duplicate email.
- **Vấn đề:** client event/booking fields, cancellation IDOR, emergency bypass, eligibility gap, invite duplicates, application writes/sequence.
- **File dự kiến:** `api/schedule/*.js`, `lib/interviewFinalizer.js`, `api/applications/*` (new if needed), client schedule/register/dashboard/community.
- **Database/API:** polls, schedules, events, bookings, applications, audit logs.
- **Hiện tại → mong muốn:** arbitrary object + client status → schema/transition server; query+batch → transaction; emergency manager-only; deterministic idempotency.
- **Biên:** two tabs, stale poll, no slot, deleted user, old documents, Meet/email partial failure.
- **Regression risk:** existing schedule docs and worktree permission changes; compatibility adapters required.
- **Migration:** add normalized fields/status version; preserve old event IDs; backfill only with dry run.
- **Rollback:** route feature flag and read legacy docs; no destructive rewrite.
- **Test:** concurrent booking/cancel/reassign, direct unauthorized URL, retry/email dedupe, cron replay.
- **Done:** all listed schedule scenarios pass with audit trail.
- **Ngoài phạm vi:** calendar provider replacement.

## Batch P1-B — Recruitment, submissions, certificates and critical client writes

- **Mục tiêu:** applications/submissions/certificates use canonical server paths and surface failures.
- **Vấn đề:** client-generated IDs, swallowed Firestore errors, spoofed identity/status, localStorage certificate forgery, community syntax error.
- **File dự kiến:** `api/applications/*`, `api/certificates/*` or verify route, `verify.html`, `community.html`, `register.html`, shared client snippets.
- **Database/API:** applications, users, submissions, certificates, audit logs.
- **Biên:** duplicate submit, reload, rejected reapply, old docs missing fields, offline/no Firebase.
- **Regression risk:** legacy numeric IDs and duplicated pages.
- **Migration:** preserve IDs; add `canonicalId/sourceVersion`; no data deletion.
- **Rollback:** read adapters and feature flag.
- **Test:** form double click/reload/unauth; server derives identity; verify cannot trust local cache; community/browser smoke.
- **Done:** no false success, no forged certificate, recruitment and submission flows traceable.
- **Ngoài phạm vi:** full monolith extraction.

## Batch P2 — UX/accessibility/architecture

- **Mục tiêu:** reduce dashboard complexity and make core flows usable on mobile/keyboard.
- **Vấn đề:** >50 tabs, mixed navigation, modal/focus/semantic gaps, duplicate IDs, inconsistent states, huge duplicated files.
- **File dự kiến:** incremental shared CSS/JS modules and targeted HTML changes; no rewrite in one release.
- **Database/API:** none unless state helpers touch endpoints.
- **Biên:** long names/emails, 320px viewport, slow network, back/deep links.
- **Regression risk:** duplicated page drift; use characterization tests first.
- **Migration/rollback:** preserve routes/IDs via aliases; revert per component.
- **Test:** browser desktop/mobile, keyboard, axe/manual contrast, console/network, performance budget.
- **Done:** core flows have loading/empty/error/success/disabled states and no blocking a11y issue.
- **Ngoài phạm vi:** branding/logo/color redesign.

## Batch P3 — polish and operations

Dependency upgrade, security headers/CSP, SEO/canonical/sitemap, service-worker versioning, CI lint/type checks, documentation cleanup. Chỉ làm sau P0/P1 gate.
