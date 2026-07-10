# Ý Niệm Điện Ảnh

Website phi lợi nhuận cho dự án Ý Niệm Điện Ảnh — cuộc thi làm phim ngắn cho học sinh, sinh viên.

## Công nghệ

- **Frontend**: HTML/CSS/JS thuần (Single Page Application), Firebase Auth, Firestore, Storage
- **Backend**: Node.js (Express) + Serverless API (Vercel)
- **Thanh toán**: PayOS
- **Bảo mật**: Cloudflare Turnstile
- **Email**: Gmail SMTP (App Password)

## Yêu cầu

- Node.js >= 18
- Tài khoản Firebase (Auth, Firestore, Storage)
- Tài khoản PayOS
- Tài khoản Cloudflare (Turnstile)
- Gmail App Password (2FA enabled)

## Cài đặt

```bash
# Cài dependencies
npm install

# Copy env example và điền thông tin
cp .env.example .env
# Sửa .env với các giá trị thật
```

## Biến môi trường (.env)

| Biến | Mô tả |
|------|-------|
| `PAYOS_CLIENT_ID` | Client ID từ PayOS |
| `PAYOS_API_KEY` | API Key từ PayOS |
| `PAYOS_CHECKSUM_KEY` | Checksum Key từ PayOS |
| `PORT` | Cổng chạy server (mặc định 24687) |
| `BASE_URL` | URL gốc (mặc định http://localhost:24687) |
| `GMAIL_USER` | Email Gmail gửi mail |
| `GMAIL_APP_PASS` | App Password Gmail |
| `TURNSTILE_SITE_KEY` | Site Key từ Cloudflare Turnstile |
| `TURNSTILE_SECRET_KEY` | Secret Key từ Cloudflare Turnstile |
| `FIREBASE_SERVICE_ACCOUNT` | Service Account JSON (dạng string) |
| `CORS_ORIGIN` | Origin được phép CORS (mặc định https://yniemdienanh.vercel.app) |

## Chạy local

```bash
npm run dev
```

## Deploy lên Vercel

1. Push code lên GitHub
2. Import project vào Vercel
3. Thêm tất cả biến môi trường vào Vercel
4. Deploy

## Cấu trúc thư mục

```
.
├── index.html          # Frontend SPA
├── index.js            # Express backend
├── api/                # Serverless functions
│   ├── config.js
│   ├── create-payment.js
│   ├── payos-webhook.js
│   ├── verify-turnstile.js
│   ├── admin/delete-user.js
│   └── email/
│       ├── send-verification.js
│       └── send-password-reset.js
├── firestore.rules     # Firestore security rules
├── vercel.json         # Vercel config
└── .env.example        # Env template
```

## Firestore Rules

Sau khi deploy, cập nhật rules từ `firestore.rules` lên Firebase Console.

## License

MIT
