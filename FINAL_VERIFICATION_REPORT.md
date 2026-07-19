# FINAL VERIFICATION REPORT — batch P0 ngày 2026-07-19

## Kết luận phát hành

**Chưa thể tuyên bố toàn hệ thống an toàn để deploy hoàn chỉnh.** Phần code/Vercel đã build được, nhưng Firebase rules chưa được compile, test allow/deny hoặc deploy; PayOS concurrency chưa được chạy với dịch vụ thật; dependency audit còn advisory nghiêm trọng. Việc deploy Vercel không thay thế deployment Firebase rules.

| Khu vực | Đã kiểm tra | Kết quả | Bằng chứng | Lỗi còn lại | Mức độ | Hành động đề xuất |
|---|---|---|---|---|---|---|
| JavaScript toàn repo | `node --check` đệ quy | Đạt: 46/46 file | `npm test` | Không có lint/type-check riêng trong project | P2 | Thêm CI ở batch sau, không mở rộng lượt này |
| Inline scripts HTML | Parse bằng `vm.Script` | Đạt: 19 script/10 HTML | `npm test` | Chưa chạy browser console/DOM đầy đủ | P1 | Browser smoke sau khi production Ready |
| Express/API local | Load app và gọi route | Đạt | health/config 200 JSON; unknown API 404 JSON; vote 401; certificate/create-payment/status/webhook fail closed; generate-certificate 410 | Không có Firebase/PayOS thật trong local smoke | P1 | Integration test với sandbox |
| Vercel route/build | Pull project settings, production build và smoke alias | Bản P0 chính đạt; bản bổ sung chức danh chưa đạt | Alias chính trỏ `dpl_GCmkDWSEYDWZfWzYSPfLSBPe7U66` Ready; `/api/health` trả 200 JSON; local build đạt | Deployment bổ sung Core/Founder `dpl_EqEF3aoNsTiLixPJVcQPLDo76fyv` đang `UNKNOWN`, chưa gắn alias | P1 operational | Chỉ promote khi deployment mới Ready; không ép alias thủ công |
| Vercel env | Kiểm tra tên biến, bổ sung Turnstile | Đạt về sự hiện diện | Firebase Admin, PayOS, mail/calendar có Production/Preview; Turnstile secret/site key đã thêm Production/Preview | Chưa xác minh rotation/giá trị bằng integration request | P1 | Smoke Turnstile và rotate theo lịch |
| Firestore rules | Code review | Đã harden trong repo | Auth email claim, self allowlist, transaction/vote/cert server-only, deny fallback | Chưa compile/emulator/deploy; production drift trước audit vẫn chưa được đóng | P0 | Firebase login → deploy rules → deny/allow matrix |
| Storage rules | Code review | Đã harden trong repo | Chỉ avatar owner, JPEG/PNG/WebP, <5 MB; wildcard deny | Chưa compile/deploy/test upload | P0 | Deploy và test owner/non-owner/type/size |
| RTDB rules | Code review | Deny-all trong repo | `database.rules.json`; client sync no-op | Chưa deploy; dữ liệu cũ chưa xóa | P0 | Deploy deny-all; giữ dữ liệu để rollback/đánh giá |
| Authentication/authorization | Static + fail-closed route smoke | Cải thiện đạt | Auth claim email verified; role grant giới hạn; profile privileged fields bị chặn | Chưa chạy account matrix thật | P1 | Test anonymous/member/candidate/HR/organizer/admin |
| Voting | Static/transaction review | Đạt ở code | Deterministic vote doc theo UID; submission status/window check; atomic count; paid-vote 410 | Chưa chạy concurrent Firestore/rules test | P1 | Hai account/nhiều tab/replay/rules denial |
| Certificate verification | Local route/static UI review | Đạt ở code | Backend canonical projection; localStorage/direct Firestore không còn là nguồn verify | Chưa tra certificate thật production | P1 | Smoke valid/invalid/revoked code |
| Payment creation | Static + fail-closed route | Đạt ở code | Server price/target, sponsor bounds, trusted URL, deterministic intent/lease, canonical response amount | PayOS external atomicity chỉ được giảm thiểu, chưa fault-injection thật | P1 | Sandbox double-click/multi-tab/network loss |
| Webhook/poll fulfillment | Transaction review | Đạt ở code | Shared atomic marker, deterministic outputs, entitlement de-dup, amount/type/status validation, orphan recovery | Chưa có concurrent integration; duplicate paid legacy order cần manual refund/reconcile | P1 | Replay webhook + poll đồng thời và reconciliation runbook |
| Dependency security | `npm audit --omit=dev` | Không đạt | 11 advisory: 1 critical, 6 high, 4 moderate | Upgrade yêu cầu breaking versions | P0 residual | Batch riêng nâng Firebase Admin/Nodemailer + regression test |
| InfinityFree/FTP | Dependency/search/diff review | Legacy, không phải blocker Vercel | Helper không còn hard-coded credential; production dùng Vercel | Credential từng commit chưa chứng minh đã revoke | P0 credential hygiene | Rotate/revoke; sau xác nhận không dependency thì xóa ở cleanup riêng |

## Logic đã thay đổi

- Quyền và email verification dựa vào Firebase Auth/Firestore server policy, không dựa flag client.
- Vote chỉ đi qua endpoint transaction idempotent, một UID/một tác phẩm; paid-vote bị retire.
- Certificate public verification chỉ đọc canonical backend và trả trường tối thiểu.
- Payment amount, target, redirect và fulfillment do server quyết định; webhook/poll hội tụ vào cùng marker/entitlement atomic.
- Client chỉ cache giao dịch để render; không tạo/xác nhận payment document.
- Turnstile, sync secret, Firebase Admin và PayOS thiếu cấu hình đều fail closed.
- Vercel có explicit deep-link rewrites và unknown API không rơi vào HTML 200.
- Chức danh lãnh đạo hỗ trợ `Founder`, `Co-founder`, `President`, `Core`; Admin được gán/chỉnh chức danh, kể cả trên chính tài khoản của mình. Quyền hệ thống Admin vẫn chỉ do tài khoản quản trị dự án cấp.

## File thay đổi trong phạm vi P0/P1 hiện có

- Rules/config: `.firebaserc`, `firebase.json`, `firestore.rules`, `storage.rules`, `database.rules.json`, `vercel.json`, `.env.example`, `.gitignore`.
- Backend: `index.js`, `lib/firebaseAdmin.js`, `lib/paymentFulfillment.js`, `lib/schedulePermissions.js`, `api/cast-vote.js`, `api/verify-certificate.js`, payment/webhook/status/Turnstile/admin và một số schedule handlers.
- Frontend: `register.html`, `index.html`, `dashboard.html`, `community.html`, `verify.html`, `schedule.html`.
- Test/docs: `test.js`, `test.bat`, `package.json`, bốn tài liệu audit/plan/report.
- Legacy được ghi nhận, không tiếp tục compatibility: `upload_infinityfree.py`, `upload_infinityfree_curl.bat`.

## Test đã chạy

1. `npm test` — đạt: server load, 46 file JS, 19 inline scripts/10 HTML.
2. Local HTTP route matrix — đạt về status/content type và fail-closed.
3. `git diff --check` — đạt sau khi bỏ trailing whitespace.
4. `vercel build --prod` — đạt.
5. `npm audit --omit=dev` — không đạt do 11 advisory; không chạy `--force` vì sẽ nâng breaking dependency ngoài phạm vi.
6. Firebase emulator/rules compiler — chưa chạy được: máy không có Java; Firebase CLI không có account đăng nhập.
7. Browser/console/responsive — đã thử kết nối in-app browser theo quy trình kiểm thử local nhưng runtime không có browser khả dụng; không dùng kết quả static để thay cho browser test.

## Migration, compatibility và rollback

- Không xóa dữ liệu hoặc đổi schema phá hủy. Các collection mới (`paymentIntents`, `payment_fulfillments`, `payment_entitlements`) là additive.
- Fulfillment vẫn query transaction legacy theo `orderCode`; dữ liệu cũ thiếu field được normalize thận trọng.
- Paid-vote lịch sử được giữ nguyên nhưng không cấp entitlement mới.
- Rollback code Vercel có thể dùng deployment Ready trước đó; không rollback bằng cách mở lại client write/rules wildcard.
- Rollback rules phải dùng bản rules đã export trước khi deploy; chưa có export/deploy trong lượt này.

## P0/P1 còn tồn tại và quyết định Founder cần xác nhận

- **P0:** deploy drift của Firebase rules; credential cũ cần rotate/revoke; dependency advisories; Vercel deployment mới chưa đạt Ready.
- **P1:** PayOS/Firebase concurrency integration, auth role matrix, schedule state machine và browser/mobile/console chưa được test end-to-end.
- Founder cần xác nhận policy no-paid-vote là chính thức; ai được xem/tra cứu certificate; danh sách payment manager; refund/reconciliation cho order lịch sử; thời điểm thực hiện breaking dependency upgrade.

## Điều kiện bắt buộc trước khi coi production an toàn

1. Giữ alias `yniemdienanh.vercel.app` ở deployment Ready. Bản bổ sung chức danh chỉ được chuyển traffic khi `dpl_EqEF3aoNsTiLixPJVcQPLDo76fyv` chuyển sang Ready và smoke đạt; không dùng các deployment `UNKNOWN` làm bằng chứng thành công.
2. Firebase rules được compile/deploy và test allow/deny độc lập.
3. PayOS sandbox vượt qua duplicate/replay/concurrency/amount mismatch/network interruption.
4. Rotate/revoke credential cũ và lập inventory secret production.
5. Có kế hoạch xử lý dependency critical/high hoặc văn bản chấp nhận rủi ro tạm thời với biện pháp giảm thiểu.
