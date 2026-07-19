# FEATURE INVENTORY — baseline 2026-07-19

Phân loại dùng trong audit: **Hoàn chỉnh**, **Hoạt động nhưng có rủi ro**, **Chưa hoàn chỉnh**, **Chỉ có giao diện**, **Không còn được sử dụng**, **Không xác định**. “Hoàn chỉnh” chỉ có nghĩa có đường chạy nhìn thấy trong code; chưa đồng nghĩa đã kiểm chứng production.

| Tính năng | Trạng thái baseline | Bằng chứng / phụ thuộc | Nhận định vận hành |
|---|---|---|---|
| Đăng ký email/password | Hoạt động nhưng có rủi ro | `register.html:1514+` | profile/sequence ghi trực tiếp client; error có thể bị nuốt |
| Đăng nhập + Google | Hoạt động nhưng có rủi ro | `register.html:1447+`, `1644+` | từng tin `users.emailVerified` do client; cần Auth token authoritative |
| Hồ sơ người dùng/avatar | Hoạt động nhưng có rủi ro | `saveProfile`, `uploadAvatarFile` | Storage wildcard và user update thiếu allowlist |
| Founder/Admin/BTC/Core/Vice/Member/candidate | Hoạt động nhưng có rủi ro | `schedulePermissions.js`, `firestore.rules`, dashboard | enum/claims chưa chuẩn; profile tự sửa có thể nâng quyền |
| Tuyển dụng/ứng tuyển | Hoạt động nhưng có rủi ro | `register.html`, `applications` | duplicate/race, client tự gửi name/email/status; approval UI và server chưa thống nhất |
| Duyệt/từ chối ứng viên | Hoạt động nhưng có rủi ro | `dashboard.html`, `community.html` | direct Firestore writes; cần server transition/audit |
| Tạo tài khoản nội bộ | Hoạt động nhưng có rủi ro | `api/admin/upsert-user.js` | non-admin people manager có thể grant organizer/title trong baseline |
| Poll lịch phỏng vấn | Hoạt động nhưng có rủi ro | `api/schedule/save-poll.js` | cần schema, ownership, idempotency |
| Chọn availability | Hoạt động nhưng có rủi ro | `meetingSchedules`, `save-availability`, rules | slot/participant và race cần server transaction |
| Chốt lịch tự động | Hoạt động nhưng có rủi ro | `lib/interviewFinalizer.js`, cron | retry/Meet có thể tạo trùng; lock chưa đủ |
| Đặt/đổi/hủy lịch | Hoạt động nhưng có rủi ro | `api/schedule/*` | IDOR, emergency flag client, query+batch race |
| Chống lịch trùng | Hoạt động nhưng có rủi ro | `confirm-interview`, `reassign-interviewer` | một số conflict check có transaction nhưng nguồn event client-controlled |
| Phân công interviewer | Hoạt động nhưng có rủi ro | `reassign-interviewer`, `send-invitations` | kiểm tra eligibility chưa đồng nhất; gửi lặp |
| Chấm phỏng vấn/nhận xét | Chưa hoàn chỉnh | `complete-interview`, user evaluations | chưa có rubric/immutable scorecard server-authoritative |
| Tổng hợp/công bố kết quả | Chỉ có giao diện / không xác định | `judging*`, `leaderboard`, UI dashboard | chưa thấy pipeline reproducible và approval version |
| Quản lý nhân sự/ban/chức vụ | Hoạt động nhưng có rủi ro | dashboard members + `upsert-user` | quá nhiều quyền qua role/dept string; cần RACI tối giản |
| Giao nhiệm vụ/deadline | Hoạt động nhưng có rủi ro | `tasks`, `plans`, dashboard | rules cho phép nội bộ rộng; ID/ownership client |
| Duyệt nội dung | Hoạt động nhưng có rủi ro | posts/feedback/docs + UI | schema/moderation và ownership thiếu |
| Sự kiện/workshop | Hoạt động nhưng có rủi ro | `events`, workshop collections | capacity/duplicate registration chưa atomic |
| Đội thi/bài dự thi | Hoạt động nhưng có rủi ro | `teams`, `submissions`, community | create rules không ràng buộc owner/field; fee path legacy |
| Voting/Audience Choice | Chưa hoàn chỉnh | `castVote` khác nhau ở 3 trang | một đường ghi sai collection, một đường client/IP; chưa server-authoritative |
| Paid-vote | Không còn được sử dụng (legacy cần migration) | `create-payment type=vote`, UI vote fee | trái policy no-paid-vote; phải reject và label lịch sử |
| Bảng xếp hạng | Chỉ có giao diện / không xác định | `leaderboard`, local vote counts | chưa có nguồn tổng hợp tin cậy |
| Thanh toán PayOS | Hoạt động nhưng có rủi ro | `create-payment`, webhook/status, fulfillment | amount/order/redirect/race và concurrent fulfillment cần khóa |
| Donation/sponsor | Hoạt động nhưng có rủi ro | type `sponsor` | amount client gửi, thiếu cap/ledger policy/idempotency |
| Chứng nhận phát hành | Hoạt động nhưng có rủi ro | payment fulfillment + `certificates` | endpoint forgery; verify tin localStorage |
| Tra cứu chứng nhận | Hoạt động nhưng có rủi ro | `verify.html` | offline cache có thể tự forge trạng thái |
| Email xác thực/reset | Hoạt động nhưng có rủi ro | `api/email/send-*`, Firebase OOB | cần rate limit phân tán, token/email consistency |
| Email nội bộ/AI | Hoạt động nhưng có rủi ro | `api/email/*`, `mailer` | quyền recipient/content, dependency và duplicate send |
| Thông báo | Hoạt động nhưng có rủi ro | `notifications`, notification email | create rules cho phép spam/targetAll |
| Dashboard | Hoạt động nhưng có rủi ro | 50+ tabs trong `dashboard.html` | choice overload, direct writes, mobile density |
| Trang quản trị | Hoạt động nhưng có rủi ro | dashboard admin tabs | quyền hiển thị client-side; server/rules phải là gate |
| Social sync | Chưa hoàn chỉnh | `api/sync/social-sync.js`, index routes | key trống có thể mở endpoint; retry/secret rotation chưa rõ |
| Homepage content editor | Hoạt động nhưng có rủi ro | `/api/homepage-content`, `config/content` | unauth file write + git push là supply-chain P0 |
| RTDB user/email index | Không còn được sử dụng (legacy) | `syncUserToRTDB` | chỉ nhân bản PII; cần ngừng ghi và khóa rules |
| Offline fallback | Chưa hoàn chỉnh / không an toàn | `register.html` localStorage auth | lưu plaintext password và tạo dữ liệu giả; không phù hợp production |
| PWA/service worker | Chỉ có giao diện | `sw.js` | cache `index.html` stale, không có update/clear strategy |

