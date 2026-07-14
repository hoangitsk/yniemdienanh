# Checklist đổi domain — Ý Niệm Điện Ảnh

Tài liệu này dùng khi chuyển từ yniemdienanh.vercel.app sang domain khác.

## 1. Domain và Vercel

- [ ] Thêm domain mới trong Vercel Project → Settings → Domains.
- [ ] Cấu hình DNS theo bản ghi mà Vercel cung cấp.
- [ ] Chờ domain có HTTPS hoạt động; kiểm tra cả domain chính và www nếu sử dụng.
- [ ] Chọn một domain chính duy nhất và chuyển hướng domain còn lại về domain chính.
- [ ] Cập nhật BASE_URL và CORS_ORIGIN trong biến môi trường production.

## 2. Google Search Console

- [ ] Thêm property mới theo dạng URL prefix: https://DOMAIN-MOI
- [ ] Chọn HTML file hoặc HTML tag để xác minh quyền sở hữu.
- [ ] Nếu chọn HTML file, đặt file xác minh ở thư mục gốc public để URL mở được trực tiếp.
- [ ] Bấm Verify sau khi deploy.
- [ ] Gửi lại sitemap: https://DOMAIN-MOI/sitemap.xml
- [ ] Kiểm tra robots.txt, homepage và các URL privacy/terms.

## 3. Google Auth Platform / OAuth Calendar-Meet

- [ ] Vào Google Auth Platform → Branding → cập nhật Homepage, Privacy Policy và Terms.
- [ ] Trong Authorized domains, xóa domain cũ nếu không còn dùng và thêm domain mới (chỉ hostname, không có https:// hay path).
- [ ] Trong OAuth Client → Authorized JavaScript origins, thay bằng https://DOMAIN-MOI.
- [ ] Trong Authorized redirect URIs, thay callback bằng:
  https://DOMAIN-MOI/api/google/oauth/callback
- [ ] Giữ redirect local nếu cần phát triển:
  http://localhost:24687/api/google/oauth/callback
- [ ] Kiểm tra lại Test users và các scope Calendar/Meet.
- [ ] Nếu đổi OAuth client, cập nhật Client ID, Client Secret và Refresh Token trong Vercel.
- [ ] Không commit Client Secret/Refresh Token vào Git.

## 4. Firebase

- [ ] Firebase Console → Authentication → Settings → Authorized domains: thêm domain mới.
- [ ] Giữ yniemdienanh-fb0b7.firebaseapp.com nếu Firebase Hosting/Auth vẫn dùng domain này.
- [ ] Nếu tạo Firebase project mới, cập nhật FIREBASE_CONFIG trong các trang HTML và FIREBASE_SERVICE_ACCOUNT trên server.
- [ ] Kiểm tra lại Firestore Rules và Storage Rules sau khi đổi project.

## 5. Email và API

- [ ] Cập nhật CORS_ORIGIN để chỉ cho phép domain mới.
- [ ] Kiểm tra BREVO_FROM_EMAIL, SPF, DKIM và domain gửi thư.
- [ ] Kiểm tra các API callback, đặc biệt /api/google/oauth/callback và /api/schedule/send-invitations.
- [ ] Kiểm tra link logo trong email, link Meet và các link reset/xác thực tài khoản.

## 6. Cập nhật URL hard-code trong mã nguồn

Chạy tìm kiếm trước khi deploy:

    rg -n "yniemdienanh\.vercel\.app|firebaseapp\.com|BASE_URL|CORS_ORIGIN|redirect" .

Kiểm tra các vị trí thường gặp:

- index.html, dashboard.html, community.html, schedule.html
- index.js
- api/email/*
- api/schedule/*
- sitemap.xml, robots.txt, manifest.json
- vercel.json
- .env và biến môi trường Vercel

## 7. Deploy và kiểm tra sau đổi domain

- [ ] Deploy production.
- [ ] Mở homepage ở chế độ ẩn danh.
- [ ] Kiểm tra đăng ký, đăng nhập, xác minh email và reset mật khẩu.
- [ ] Kiểm tra Firestore đọc/ghi.
- [ ] Kiểm tra tạo lịch, phân công HR, gửi thư và file .ics.
- [ ] Kiểm tra OAuth Calendar/Meet bằng tài khoản admin.
- [ ] Kiểm tra các trang /privacy, /terms, /schedule, /verify.
- [ ] Kiểm tra Search Console và gửi yêu cầu xác minh lại nếu Google yêu cầu.

## Domain hiện tại

- Production: https://yniemdienanh.vercel.app
- Firebase Auth domain: yniemdienanh-fb0b7.firebaseapp.com
- OAuth callback dự kiến: /api/google/oauth/callback
- File xác minh Search Console hiện tại: /google832c51429493ac4c.html

Khi đổi domain, cập nhật checklist này và không xóa domain cũ cho đến khi các phiên đăng nhập, OAuth token và email đã được kiểm tra đầy đủ.
