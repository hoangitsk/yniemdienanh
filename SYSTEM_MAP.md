# SYSTEM MAP — Ý Niệm Điện Ảnh

**Ngày audit:** 2026-07-19  
**Phạm vi:** repository hiện tại, cấu hình deploy, Firestore/Storage rules trong repo và các route/API được tham chiếu từ client.  
**Trạng thái:** bản đồ baseline trước sửa; production rules/routes phải được export và đối chiếu lại trước khi coi là đồng bộ.

## 1. Kiến trúc và công nghệ

| Lớp | Công nghệ | Vị trí chính | Ghi chú vận hành |
|---|---|---|---|
| Public frontend | HTML/CSS/JS inline, Firebase compat SDK | `index.html`, `community.html`, `dashboard.html`, `register.html`, `schedule.html`, `verify.html`, `vinh-danh.html` | Ba trang lớn chứa logic gần như sao chép; không có bundler/type-check |
| Auth | Firebase Authentication (email/password, Google) | `register.html`, các inline script | ID token được gửi trong JSON body tới backend; profile vẫn được dùng cho UI |
| Primary database | Cloud Firestore | `firestore.rules`, các `loadInternalDataFromFirestore`/`saveItem` | Nhiều collection camelCase ở client không khớp rule snake_case |
| Legacy database | Firebase Realtime Database | `syncUserToRTDB` trong ba trang lớn | Chỉ dùng để nhân bản user/email index; không có rules file trong baseline |
| File storage | Firebase Storage | `storage.rules`, `uploadAvatarFile` | Frontend hiện chỉ upload avatar; rule wildcard cho phép ghi rộng |
| Application server | Express 4, Node.js | `index.js` | Static hosting + API + SPA fallback; `app.listen` chạy khi module được require |
| Serverless surface | Vercel functions | `api/**/*.js` | Một số auth/rate-limit chỉ nằm ở Express wrapper, dễ drift khi gọi function trực tiếp |
| Payment | PayOS | `api/create-payment.js`, `api/payos-webhook.js`, `api/payment-status.js`, `lib/paymentFulfillment.js` | Server tính một phần giá; vẫn còn legacy paid-vote path |
| Abuse protection | Cloudflare Turnstile | `api/verify-turnstile.js`, `index.js`, forms | Baseline cho phép dev success khi thiếu secret |
| Email/AI | Brevo/Gmail fallback, Gemini | `lib/mailer.js`, `api/email/*`, `lib/gemini.js` | Email HTML do operator cung cấp được normalize một phần |
| Deployment | Vercel + helper FTP/GitHub | `vercel.json`, `deploy.bat`, `upload_infinityfree*` | Vercel route drift; helper FTP từng chứa credential thật |

## 2. Routes và trang

| Route | File | Audience / quyền dự kiến |
|---|---|---|
| `/` | `index.html` | khách, thành viên đã đăng nhập |
| `/register` | `register.html` | khách/ứng viên; đăng nhập, đăng ký, ứng tuyển |
| `/dashboard` | `dashboard.html` | thành viên và nội bộ, nội dung thay đổi theo role |
| `/community` | `community.html` | cộng đồng + nội bộ; baseline JS đang lỗi parse |
| `/schedule`, `/schedule/:code` | `schedule.html` | ứng viên, người phỏng vấn, HR/PR, quản lý lịch |
| `/verify` | `verify.html` | công khai; tra cứu chứng nhận |
| `/vinh-danh` | `vinh-danh.html` | công khai; danh sách vinh danh |
| `/privacy`, `/terms` | static legal pages | công khai |
| `/payment-success`, `/payment-cancel` | SPA fallback | người thanh toán |

`index.js` còn có catch-all `app.get('*')`; baseline production smoke cho thấy một số `/api/*` không tồn tại bị trả HTML thay vì JSON.

## 3. Nhóm người dùng và quyền hiện có

| Nhóm nghiệp vụ | Biểu diễn hiện tại | Nguồn quyết định | Rủi ro |
|---|---|---|---|
| Founder / tài khoản gốc | email hard-coded `yniemdienanh@gmail.com`, đôi khi `role=admin` | `isProjectAdminEmail`, `schedulePermissions.js` | bus factor và email đặc biệt nằm trong nhiều file |
| Admin | `users.role == 'admin'` | Firestore rules + backend | cần tách thao tác tài chính và quản trị |
| Quản lý nội bộ/BTC | `role=organizer` | rules/backend | quá rộng; UI còn gọi là BTC, organizer, manager |
| HR/PR | `dept`/position/title chứa chuỗi HR/PR | `isPeopleManager`, `isScheduleManager` | nếu profile tự sửa được thì privilege escalation |
| President/Core/Vice | role hoặc text trong `position/title/leadershipTitle` | schedule UI/backend | chưa có enum/claims chuẩn |
| Member/cộng đồng | `role=member`, `projectGroup=community` hoặc thiếu group | client/rules | thiếu ownership/schema ở nhiều collection |
| Candidate/ứng viên | `projectGroup=candidate` hoặc application pending | user profile/application | phải không được xem như nhân sự nội bộ |
| Khách | không có Firebase auth | public routes | public data/rules production cần kiểm tra lại |

**Giả định an toàn dùng cho kế hoạch:** `role`/`projectGroup`/`dept`/`leadershipTitle` là server-authoritative; chỉ Admin/Founder được nâng quyền nội bộ. Candidate không phải staff. Firestore là nguồn dữ liệu chuẩn; RTDB legacy sẽ ngừng ghi và khóa rules. Audience Choice là một vote miễn phí/account/work, không có paid-vote.

## 4. Collections và quan hệ dữ liệu

### Core collections (đã thấy trực tiếp trong client/backend)

- `users`: profile, role, department, status, evaluations/awards legacy.
- `applications`: hồ sơ ứng tuyển và trạng thái duyệt.
- `events`, `registrations`: sự kiện và đăng ký.
- `submissions`, `teams`, `team_members`: đội thi và bài dự thi.
- `submissions/{submissionId}/votes/{uid}`: cấu trúc vote mới; legacy client còn ghi top-level `votes`.
- `transactions`, `budget`, `config/{sequence|sequence|settings|prizePool}`: tài chính và cấu hình.
- `availabilityPolls`, `meetingSchedules`, `scheduledEvents`, `scheduledBookings`, `rescheduleRequests`: lịch phỏng vấn.
- `tasks`, `plans`, `announcements`, `docs`, `notifications`, `feedback`, `messages`, `posts`, `comments`.
- `certificates`, `judging`, `judging_scores`, `leaderboard`, `gala`.
- Các module mở rộng: workshop, mentor, crew finder, production handbook/diary, learning, alumni, partner, survey, season, media.

### Quan hệ chính

```text
users ──< applications ──(approve)──> users/projectGroup
users ──< teams ──< team_members
teams ──< submissions ──< votes/{uid}
users ──< transactions ──(PayOS webhook)──> registrations/submissions/certificates/budget
availabilityPolls ──< meetingSchedules/{pollId_uid}
availabilityPolls ──< scheduledEvents ──< scheduledBookings
scheduledBookings ──< rescheduleRequests
submissions ──< judging_scores ──> leaderboard/results (legacy/incomplete)
```

## 5. API surface

### Express routes in `index.js`

Auth/email: `/api/email/send-verification`, `/api/email/send-password-reset`, `/api/email/send-custom`, `/api/email/generate-gemini-*`; payment: `/api/create-payment`, `/api/payment-status`, `/api/payos-webhook`; schedule: `/api/schedule/*`; admin: `/api/admin/upsert-user`, `/api/admin/delete-user`; content/social: `/api/homepage-content`, `/api/social-posts`, `/api/sync/*`; certificate/Turnstile: `/api/generate-certificate`, `/api/verify-turnstile`; health/config and SPA routes.

### Direct Vercel function files

`api/create-payment.js`, `api/payment-status.js`, `api/payos-webhook.js`, `api/verify-turnstile.js`, `api/award-xp.js`, `api/admin/*`, `api/email/*`, `api/schedule/*`, `api/cron/finalize-interviews.js`, `api/sync/social-sync.js`, `api/config.js`.

**Dependency warning:** Express rate limiting and wrapper middleware do not automatically protect a function invoked directly by the platform. Every sensitive function therefore needs its own auth, schema, and rate limit.

## 6. Luồng nghiệp vụ baseline

1. **Đăng ký/đăng nhập:** Firebase Auth → client tạo/đọc `users`; email verification và profile completion trên client.
2. **Ứng tuyển:** form tạo document `applications` bằng `getNextId`/`saveItem`; HR/BTC đổi status và có thể tạo user qua `/api/admin/upsert-user`.
3. **Lịch phỏng vấn:** manager tạo poll/event; ứng viên ghi availability; cron/finalizer chọn slot; booking/confirmation/reassign/email/Meet.
4. **Nội dung cộng đồng:** posts/comments/messages/ideas/task modules ghi trực tiếp Firestore.
5. **Bài dự thi/voting:** submission ghi trực tiếp; client có hai đường vote không tương thích; paid-vote legacy gọi PayOS.
6. **Thanh toán:** server tạo PayOS order và transaction pending; webhook/status gọi fulfillment; client còn có đường confirm local/admin trực tiếp.
7. **Chứng nhận:** PayOS fulfillment ghi certificates; `verify.html` còn tin localStorage trước Firestore.
8. **Thông báo/email:** client gửi token + dữ liệu tới API; backend mailer/AI xử lý.

## 7. Thành phần lớn/trùng trách nhiệm

- `index.html`, `dashboard.html`, `community.html`: 10k+ dòng mỗi file, nhiều hàm và CSS/HTML sao chép, dễ drift.
- `schedule.html`: 3.6k dòng, nghiệp vụ lịch dày và có listener/retry/timeout riêng.
- `index.js`: 700+ dòng, trộn server bootstrap, auth middleware, email, payment, content file, social sync và static routing.
- `saveItem`/`getNextId` trong nhiều trang: client quyết định ID, nuốt lỗi Firestore và ghi collection không đồng nhất.
- `firestore.rules`: 590+ dòng phát triển theo module, nhiều `allow create/write` không ràng buộc ownership/schema.

## 8. Dependency và coupling quan trọng

- Auth/profile fields → mọi kiểm tra role, schedule và dashboard.
- `config/sequence` → hầu hết document ID legacy; thao tác không atomic từ client.
- `transactions` → PayOS webhook/status → registrations/certificates/budget/prizePool.
- `availabilityPolls`/`meetingSchedules` → event/booking/finalizer/email/Meet.
- `projectGroup`/`leadershipTitle` (thay đổi worktree hiện tại) → eligibility interviewer và dashboard member grouping.
- `homepage-content.json`/`config/content` → landing copy; endpoint cũ còn git push.

