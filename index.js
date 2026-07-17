const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const PayOS = require('@payos/node');
const nodemailer = require('nodemailer');
const admin = require('firebase-admin');
const { generateGeminiJson, getGeminiConfig } = require('./lib/gemini');
const { ensureInterviewScheduleContent, normalizeEmailContent } = require('./lib/emailContent');
const { normalizeEmailSender, emailSenderPromptContext, applyEmailSenderIdentity } = require('./lib/emailSender');
const { normalizePdfAttachment } = require('./lib/pdfAttachment');
const { PROJECT_HANDBOOK_EMAIL_CONTEXT } = require('./lib/projectIdentity');
const { isPeopleManager, isScheduleManager } = require('./lib/schedulePermissions');
const generateGeminiBulkEmails = require('./api/email/generate-gemini-bulk');
require('dotenv').config();

const PAYOS_CLIENT_ID = process.env.PAYOS_CLIENT_ID || "";
const PAYOS_API_KEY = process.env.PAYOS_API_KEY || "";
const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY || "";

const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || "";

const PAYOS_ENABLED = !!(PAYOS_CLIENT_ID && PAYOS_API_KEY && PAYOS_CHECKSUM_KEY);
const payos = PAYOS_ENABLED ? new PayOS(PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY) : null;

// Initialize Firebase Admin
let db = null;
const FIREBASE_SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT;
if (FIREBASE_SERVICE_ACCOUNT) {
    try {
        if (!admin.apps.length) {
            let serviceAccountStr = FIREBASE_SERVICE_ACCOUNT.trim();
            if (serviceAccountStr.startsWith('"') && serviceAccountStr.endsWith('"')) {
                serviceAccountStr = serviceAccountStr.slice(1, -1);
            }
            let serviceAccount = JSON.parse(serviceAccountStr);
            if (typeof serviceAccount === 'string') {
                serviceAccount = JSON.parse(serviceAccount);
            }
            if (serviceAccount.private_key) {
                serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
            }
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }
        db = admin.firestore();
        console.log("Firebase Admin initialized successfully.");
    } catch (err) {
        console.error("Failed to initialize Firebase Admin:", err);
    }
} else {
    console.warn("FIREBASE_SERVICE_ACCOUNT environment variable is not defined. Webhook will verify payments but cannot update database.");
}

const app = express();
var CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://yniemdienanh.vercel.app';
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '3mb' }));

// Simple in-memory rate limiter
var rateLimitStore = {};
function rateLimit(limit, windowMs) {
    return function(req, res, next) {
        var key = req.ip + ':' + req.path;
        var now = Date.now();
        if (!rateLimitStore[key] || rateLimitStore[key].resetAt < now) {
            rateLimitStore[key] = { count: 0, resetAt: now + windowMs };
        }
        rateLimitStore[key].count++;
        if (rateLimitStore[key].count > limit) {
            return res.status(429).json({ error: 'Qua nhieu yeu cau. Vui long thu lai sau.' });
        }
        next();
    };
}

// Apply rate limiting to sensitive endpoints. Bulk sending calls send-custom once
// per recipient, so keep its authenticated allowance separate from public auth mail.
app.use('/api/email/send-custom', rateLimit(120, 60000));
app.use('/api/email/generate-', rateLimit(20, 60000));
app.use('/api/email/send-verification', rateLimit(5, 60000));
app.use('/api/email/send-password-reset', rateLimit(5, 60000));
app.use('/api/send-notification-email', rateLimit(5, 60000));
app.use('/api/create-payment', rateLimit(10, 60000)); // 10 per minute for payments
app.use('/api/verify-turnstile', rateLimit(20, 60000)); // 20 per minute for turnstile
app.use('/api/admin/', rateLimit(10, 60000));       // 10 per minute for admin APIs
app.use('/api/schedule/', rateLimit(60, 60000));    // Autosave lịch có thể tạo nhiều yêu cầu liên tiếp

function requireAuthorizedProfile(permissionCheck) {
    return async function(req, res, next) {
        try {
            const idToken = req.body && req.body.idToken;
            if (!idToken) return res.status(401).json({ error: 'Vui lòng đăng nhập lại.' });
            const decoded = await admin.auth().verifyIdToken(idToken);
            const profileDoc = await admin.firestore().collection('users').doc(decoded.uid).get();
            const profile = profileDoc.exists ? profileDoc.data() : {};
            if (!decoded.email_verified || !permissionCheck(decoded, profile)) {
                return res.status(403).json({ error: 'Tài khoản không có quyền thực hiện thao tác này.' });
            }
            req.authUser = decoded;
            next();
        } catch (error) {
            return res.status(error.code === 'auth/id-token-expired' ? 401 : 500).json({ error: error.message || 'Không thể xác thực tài khoản.' });
        }
    };
}

const requirePeopleManager = requireAuthorizedProfile(isPeopleManager);
const requireScheduleManager = requireAuthorizedProfile(isScheduleManager);

const PORT = process.env.PORT || 24687;
const PYTHON_PORT = process.env.PYTHON_PORT || 8000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Brevo SMTP transporter
const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.BREVO_SMTP_LOGIN,
        pass: process.env.BREVO_SMTP_KEY,
    },
});

// Firebase REST API for generating OOB links
const FIREBASE_API_KEY = 'AIzaSyBCDm2B4jkFJ-B62aOpVar9uxXlVxT3QDQ';
const FIREBASE_AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`;

// Helper: fetch với timeout
async function fbFetch(body) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
        const res = await fetch(FIREBASE_AUTH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: ctrl.signal,
        });
        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}

// Email API endpoints
app.post('/api/email/send-verification', async (req, res) => {
    try {
        const { idToken, email, userName } = req.body;
        if (!idToken || !email) return res.status(400).json({ error: 'Missing idToken or email' });

        const displayName = (userName || '').trim() || 'bạn';

        // Verify idToken belongs to the claimed email (security: prevent email spoofing)
        let oobLink = null;
        let adminErrDetail = null;

        // Try using Firebase Admin SDK first
        if (admin.apps.length && db) {
            try {
                const decoded = await admin.auth().verifyIdToken(idToken);
                if (decoded.email !== email) {
                    return res.status(403).json({ error: 'Email không khớp với token.' });
                }
                oobLink = await admin.auth().generateEmailVerificationLink(email);
                console.log('Admin SDK generated verification link for', email);
            } catch (adminErr) {
                adminErrDetail = adminErr.message || String(adminErr);
                console.warn('Firebase Admin generate link failed, falling back:', adminErr.message || adminErr);
            }
        }

        // Fallback to public Identity Toolkit REST API (REST API verifies idToken internally)
        if (!oobLink) {
            const fbData = await fbFetch({ requestType: 'VERIFY_EMAIL', idToken, returnOobLink: true });
            if (fbData.oobLink) {
                oobLink = fbData.oobLink;
            } else {
                console.error('Firebase REST OOB error:', JSON.stringify(fbData));
                return res.status(500).json({ 
                    error: 'Firebase OOB link failed', 
                    detail: fbData,
                    adminError: adminErrDetail,
                    adminInitError: admin.apps.length ? null : 'Admin SDK not initialized',
                    adminAppsLength: admin.apps.length,
                    hasServiceAccountEnv: !!process.env.FIREBASE_SERVICE_ACCOUNT
                });
            }
        }

        // Lấy STT người đăng ký
        let regNo = '';
        try {
            if (db) {
                const usersSnap = await db.collection('users').count().get();
                regNo = String((usersSnap.data().count || 0) + 1);
            }
        } catch (e) {
            regNo = String(Math.floor(Date.now() / 1000) % 100000);
        }

        const currentYear = new Date().getFullYear();

        await transporter.sendMail({
            from: `"${process.env.BREVO_FROM_NAME}" <${process.env.BREVO_FROM_EMAIL}>`,
            to: email,
            subject: `Xác thực tài khoản Ý Niệm Điện Ảnh — ${displayName}`,
            text: `XÁC THỰC TÀI KHOẢN Ý NIỆM ĐIỆN ẢNH
            \nXin chào ${displayName},
            \nCảm ơn bạn đã đăng ký tại Ý Niệm Điện Ảnh!
            \nMã số đăng ký của bạn: #YNDA-${regNo}
            \nVui lòng bấm link bên dưới để xác thực email:
            \n${oobLink}
            \nSau khi xác thực, bạn có thể đăng nhập và tham gia cộng đồng điện ảnh.
            \nNếu bạn không đăng ký tài khoản này, vui lòng bỏ qua email này.
            \n© ${currentYear} Ý Niệm Điện Ảnh — Nơi Ý Tưởng Cất Cánh`,
            html: `
                <div style="max-width:600px;margin:auto;background:#0d0d0d;padding:0;border-radius:12px;overflow:hidden;font-family:'Be Vietnam Pro',Helvetica,Arial,sans-serif">
                    <div style="background:linear-gradient(135deg,#1a1008 0%,#0d0d0d 50%,#1a1008 100%);padding:40px 30px 30px;text-align:center;border-bottom:2px solid rgba(228,184,102,0.2)">
                        <img src="https://yniemdienanh.vercel.app/Logo/logo%20ngang.png" alt="Ý Niệm Điện Ảnh" style="max-height:56px;margin-bottom:8px">
                    </div>
                    <div style="background:#0d0d0d;padding:30px 35px">
                        <div style="text-align:center;margin-bottom:28px">
                            <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#e4b866,#cc9d4f);display:inline-flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:16px;box-shadow:0 4px 20px rgba(228,184,102,0.3)">🎬</div>
                            <h2 style="color:#f3dba3;font-size:22px;margin:0 0 8px;font-weight:700;letter-spacing:0.5px">Xác thực tài khoản</h2>
                            <p style="color:#a0a0a0;font-size:14px;line-height:1.7;margin:0">
                                Xin chào <strong style="color:#e4b866">${displayName}</strong>,
                                <br>Cảm ơn bạn đã đăng ký tại <strong style="color:#e4b866">Ý Niệm Điện Ảnh</strong>!
                            </p>
                        </div>
                        <div style="background:rgba(228,184,102,0.05);border:1px solid rgba(228,184,102,0.15);border-radius:10px;padding:16px 20px;margin-bottom:24px">
                            <table style="width:100%;border-collapse:collapse;font-size:13px;color:#c0c0c0">
                                <tr>
                                    <td style="padding:6px 0;color:#888;width:100px">Mã số ĐK</td>
                                    <td style="padding:6px 0;color:#f3dba3;font-weight:700;font-family:monospace">#YNDA-${regNo}</td>
                                </tr>
                                <tr>
                                    <td style="padding:6px 0;color:#888">Email</td>
                                    <td style="padding:6px 0;color:#e2e8f0">${email}</td>
                                </tr>
                                <tr>
                                    <td style="padding:6px 0;color:#888">Trạng thái</td>
                                    <td style="padding:6px 0"><span style="display:inline-block;padding:2px 10px;border-radius:20px;background:rgba(251,191,36,0.15);color:#fbbf24;font-size:12px;font-weight:600">Chờ xác thực</span></td>
                                </tr>
                            </table>
                        </div>
                        <div style="text-align:center;margin:28px 0">
                            <a href="${oobLink}" style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg,#e4b866,#cc9d4f);color:#0d0d0d;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;letter-spacing:0.5px;box-shadow:0 4px 15px rgba(228,184,102,0.25)">Xác thực tài khoản</a>
                        </div>
                        <p style="color:#666;font-size:12px;line-height:1.6;text-align:center;margin-top:24px">Sau khi xác thực, bạn có thể đăng nhập và tham gia cộng đồng điện ảnh.</p>
                        <p style="color:#555;font-size:11px;line-height:1.5;text-align:center;margin-top:12px;border-top:1px solid rgba(255,255,255,0.04);padding-top:16px">Nếu bạn không đăng ký tài khoản này, vui lòng bỏ qua email này.</p>
                    </div>
                    <div style="background:#0a0a0a;padding:20px 35px;text-align:center;border-top:1px solid rgba(228,184,102,0.08)">
                        <p style="color:#555;font-size:12px;margin:0 0 4px">© ${currentYear} Ý Niệm Điện Ảnh — Nơi Ý Tưởng Cất Cánh</p>
                        <p style="color:#444;font-size:11px;margin:0">Email này được gửi tự động, vui lòng không trả lời.</p>
                    </div>
                </div>
            `,
        });

        console.log('Verification email sent to', email, 'for user', displayName);
        res.json({ success: true });
    } catch (err) {
        console.error('Send verification error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/email/send-password-reset', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Missing email' });

        let oobLink = null;

        if (admin.apps.length && db) {
            try {
                oobLink = await admin.auth().generatePasswordResetLink(email);
            } catch (adminErr) {
                console.warn('Firebase Admin reset link failed, falling back:', adminErr.message || adminErr);
            }
        }

        if (!oobLink) {
            const fbData = await fbFetch({ requestType: 'PASSWORD_RESET', email, returnOobLink: true });
            if (fbData.oobLink) {
                oobLink = fbData.oobLink;
            } else {
                console.error('Firebase REST OOB error:', JSON.stringify(fbData));
                return res.status(500).json({ error: 'Firebase OOB link failed', detail: fbData });
            }
        }

        const currentYear = new Date().getFullYear();

        await transporter.sendMail({
            from: `"${process.env.BREVO_FROM_NAME}" <${process.env.BREVO_FROM_EMAIL}>`,
            to: email,
            subject: 'Đặt lại mật khẩu Ý Niệm Điện Ảnh',
            text: `ĐẶT LẠI MẬT KHẨU Ý NIỆM ĐIỆN ẢNH\n\nBạn vừa yêu cầu đặt lại mật khẩu cho tài khoản Ý Niệm Điện Ảnh.\n\nBấm link bên dưới để tạo mật khẩu mới:\n${oobLink}\n\nLink có hiệu lực trong 1 giờ. Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.\n\n© ${currentYear} Ý Niệm Điện Ảnh — Nơi Ý Tưởng Cất Cánh`,
            html: `
                <div style="max-width:600px;margin:auto;background:#0d0d0d;padding:0;border-radius:12px;overflow:hidden;font-family:'Be Vietnam Pro',Helvetica,Arial,sans-serif">
                    <div style="background:linear-gradient(135deg,#1a1008 0%,#0d0d0d 50%,#1a1008 100%);padding:40px 30px 30px;text-align:center;border-bottom:2px solid rgba(228,184,102,0.2)">
                        <img src="https://yniemdienanh.vercel.app/Logo/logo%20ngang.png" alt="Ý Niệm Điện Ảnh" style="max-height:56px;margin-bottom:8px">
                    </div>
                    <div style="background:#0d0d0d;padding:30px 35px">
                        <div style="text-align:center;margin-bottom:28px">
                            <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#e4b866,#cc9d4f);display:inline-flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:16px;box-shadow:0 4px 20px rgba(228,184,102,0.3)">🔑</div>
                            <h2 style="color:#f3dba3;font-size:22px;margin:0 0 8px;font-weight:700;letter-spacing:0.5px">Đặt lại mật khẩu</h2>
                            <p style="color:#a0a0a0;font-size:14px;line-height:1.7;margin:0">Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản <strong style="color:#e4b866">Ý Niệm Điện Ảnh</strong>.<br>Bấm nút bên dưới để tạo mật khẩu mới:</p>
                        </div>
                        <div style="text-align:center;margin:28px 0">
                            <a href="${oobLink}" style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg,#e4b866,#cc9d4f);color:#0d0d0d;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;letter-spacing:0.5px;box-shadow:0 4px 15px rgba(228,184,102,0.25)">Đặt lại mật khẩu</a>
                        </div>
                        <p style="color:#777;font-size:11px;line-height:1.5;text-align:center;margin-top:16px">🔒 Link có hiệu lực trong <strong style="color:#aaa">1 giờ</strong>. Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
                    </div>
                    <div style="background:#0a0a0a;padding:20px 35px;text-align:center;border-top:1px solid rgba(228,184,102,0.08)">
                        <p style="color:#555;font-size:12px;margin:0 0 4px">© ${currentYear} Ý Niệm Điện Ảnh — Nơi Ý Tưởng Cất Cánh</p>
                        <p style="color:#444;font-size:11px;margin:0">Email này được gửi tự động, vui lòng không trả lời.</p>
                    </div>
                </div>
            `,
        });

        console.log('Password reset email sent to', email);
        res.json({ success: true });
    } catch (err) {
        console.error('Send password reset error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/create-payment', require('./api/create-payment'));

app.get('/api/payment-status', require('./api/payment-status'));

app.post('/api/payos-webhook', require('./api/payos-webhook'));

// API: Send notification email (support questions, deadline extensions, etc.)
app.post('/api/send-notification-email', requireScheduleManager, async (req, res) => {
    try {
        const { to, subject, html } = req.body;
        if (!to || !subject || !html) return res.status(400).json({ error: 'Missing required fields' });
        await transporter.sendMail({
            from: `"${process.env.BREVO_FROM_NAME}" <${process.env.BREVO_FROM_EMAIL}>`,
            to,
            subject,
            html: `
                <div style="max-width:600px;margin:auto;background:#0d0d0d;padding:0;border-radius:12px;overflow:hidden;font-family:'Be Vietnam Pro',Helvetica,Arial,sans-serif">
                    <div style="background:linear-gradient(135deg,#1a1008 0%,#0d0d0d 50%,#1a1008 100%);padding:20px;text-align:center;border-bottom:2px solid rgba(228,184,102,0.2)">
                        <img src="https://yniemdienanh.vercel.app/Logo/logo%20ngang.png" alt="Ý Niệm Điện Ảnh" style="max-height:40px">
                    </div>
                    <div style="padding:30px;color:#e2e8f0;font-size:14px;line-height:1.7">${html}</div>
                    <div style="background:#0a0a0a;padding:20px;text-align:center;border-top:1px solid rgba(228,184,102,0.08)">
                        <p style="color:#555;font-size:12px;margin:0">© ${new Date().getFullYear()} Ý Niệm Điện Ảnh — Nơi Ý Tưởng Cất Cánh</p>
                    </div>
                </div>
            `
        });
        res.json({ success: true });
    } catch (err) {
        console.error('Send notification email error:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Generate personalized email with Gemini
app.post('/api/email/generate-gemini-bulk', generateGeminiBulkEmails);

app.post('/api/email/generate-gemini-reply', requirePeopleManager, async (req, res) => {
    const { keys } = getGeminiConfig();
    if (keys.length === 0) {
        return res.status(500).json({ error: 'GEMINI_API_KEY chưa được cấu hình trên server.' });
    }
    try {
        const { type, name, role, dept, intro, vision, emailType, customDescription } = req.body;
        if (!name || !emailType) {
            return res.status(400).json({ error: 'Thiếu thông tin ứng viên (name) hoặc loại email (emailType)' });
        }

        const scheduleUrl = process.env.SCHEDULE_PUBLIC_URL || 'https://yniemdienanh.vercel.app/schedule';
        const sender = normalizeEmailSender(req.body);
        const prompt = `Bạn là trợ lý soạn email cho dự án Ý Niệm Điện Ảnh.
Thông tin chính thức từ Sổ tay dự án:
${PROJECT_HANDBOOK_EMAIL_CONTEXT}

${emailSenderPromptContext(sender)}

Hãy soạn thảo một email phản hồi ứng tuyển dựa trên thông tin dưới đây:
- Tên ứng viên: ${name}
- Loại đơn ứng tuyển: ${type === 'organizer' ? 'Ban Tổ Chức' : type === 'cofounder' ? 'Co-founder' : type === 'president' ? 'President' : 'Thành viên'}
- Ban ứng tuyển: ${dept || 'Cộng đồng'}
- Giới thiệu bản thân: ${intro || 'N/A'}
${vision ? `- Tầm nhìn / Ý tưởng đóng góp: ${vision}` : ''}

        Loại email cần soạn: ${emailType === 'approve' ? 'Duyệt đơn và Chào mừng tham gia dự án (Email ấm áp, hào hứng, chào mừng họ gia nhập đội ngũ)' : emailType === 'round1_pass' ? 'Chúc mừng ứng viên đã vượt qua vòng 1. Thông báo rõ trong vòng 3 ngày tới Ban Nhân Sự sẽ gửi email tiếp theo để ứng viên lựa chọn lịch phỏng vấn; thư này chưa yêu cầu chọn lịch ngay.' : emailType === 'reject' ? 'Từ chối đơn ứng tuyển (Email chân thành, lịch sự, cảm ơn sự quan tâm và chúc họ may mắn trong hành trình sắp tới)' : emailType === 'custom' ? 'Thư tùy chỉnh theo yêu cầu riêng của người phụ trách bên dưới' : 'Mời tham gia phỏng vấn (Email hẹn phỏng vấn, đề xuất họ chọn lịch hẹn)'}.
        ${customDescription ? `- Yêu cầu riêng của người phụ trách: ${String(customDescription).slice(0, 1000)}` : ''}
${emailType === 'interview' ? `Bắt buộc có nút hoặc liên kết HTML đến "${scheduleUrl}" với lời mời chọn thời gian rảnh. Giải thích hệ thống chốt lịch lúc 0h hằng ngày theo giờ Việt Nam; nếu chưa được chốt, ứng viên vẫn có thể cập nhật phiếu đến hết thời hạn đợt phỏng vấn.` : ''}

Yêu cầu định dạng:
Trả về kết quả dưới dạng JSON có cấu trúc chính xác như sau:
{
  "subject": "Tiêu đề email hấp dẫn, ngắn gọn, phù hợp với nội dung",
  "body": "Nội dung email bằng tiếng Việt, trình bày đẹp mắt dưới dạng HTML (chỉ sử dụng các thẻ HTML cơ bản như <p>, <br>, <strong>, <ul>, <li> để định dạng. Không sử dụng thẻ <html>, <body>, <head>)."
}

        Chú ý: Email cần viết bằng tiếng Việt, văn phong ấm áp, chuyên nghiệp, truyền cảm hứng và mang tính chất kết nối. Có thể dùng "chúng tôi" khi đại diện dự án, gọi ứng viên là "${name}", nhưng chữ ký cuối thư phải đúng danh tính người phụ trách đã cung cấp.`;

        const result = await generateGeminiJson(prompt);
        const email = applyEmailSenderIdentity(ensureInterviewScheduleContent(result.data, emailType, scheduleUrl), sender);
        res.setHeader('X-Gemini-Model', result.model);
        res.status(200).json(email);
    } catch (err) {
        console.error('Error generating Gemini email:', err);
        if (err.attempts) console.error('Gemini fallback attempts:', err.attempts);
        res.status(err.status || 500).json({ error: err.message });
    }
});

// API: Send custom email
app.post('/api/email/send-custom', requireScheduleManager, async (req, res) => {
    try {
        const { to, subject, html, attachment } = req.body;
        if (!to || !subject || !html) {
            return res.status(400).json({ error: 'Missing to, subject, or html' });
        }

        const fromName = process.env.BREVO_FROM_NAME || 'Ý Niệm Điện Ảnh';
        const fromEmail = process.env.BREVO_FROM_EMAIL;
        if (!fromEmail) {
            return res.status(500).json({ error: 'BREVO_FROM_EMAIL chưa được cấu hình.' });
        }

        const pdfAttachment = normalizePdfAttachment(attachment);
        const normalizedHtml = normalizeEmailContent({ body: html }).body;
        await transporter.sendMail({
            from: `"${fromName}" <${fromEmail}>`,
            to,
            subject,
            html: `
                <div style="max-width:600px;margin:auto;background:#0d0d0d;padding:0;border-radius:12px;overflow:hidden;font-family:'Be Vietnam Pro',Helvetica,Arial,sans-serif">
                    <div style="background:linear-gradient(135deg,#1a1008 0%,#0d0d0d 50%,#1a1008 100%);padding:20px;text-align:center;border-bottom:2px solid rgba(228,184,102,0.2)">
                        <img src="https://yniemdienanh.vercel.app/Logo/logo%20ngang.png" alt="Ý Niệm Điện Ảnh" style="max-height:40px">
                    </div>
                    <div style="padding:30px;color:#e2e8f0;font-size:14px;line-height:1.7;background:#0d0d0d">${normalizedHtml}</div>
                    <div style="background:#0a0a0a;padding:20px;text-align:center;border-top:1px solid rgba(228,184,102,0.08)">
                        <p style="color:#555;font-size:12px;margin:0">© ${new Date().getFullYear()} Ý Niệm Điện Ảnh — Nơi Ý Tưởng Cất Cánh</p>
                    </div>
                </div>
            `,
            attachments: pdfAttachment ? [pdfAttachment] : []
        });

        res.json({ success: true });
    } catch (err) {
        console.error('Send custom email error:', err);
        res.status(err.status || 500).json({ error: err.message });
    }
});

// API: Gửi thư lịch phỏng vấn cho ứng viên và HR được phân công.
const sendScheduleInvitations = require('./api/schedule/send-invitations');
app.post('/api/schedule/send-invitations', sendScheduleInvitations);
const listScheduleUsers = require('./api/schedule/list-users');
app.post('/api/schedule/list-users', listScheduleUsers);
const saveScheduleEvent = require('./api/schedule/save-event');
app.post('/api/schedule/save-event', saveScheduleEvent);
const saveScheduleBooking = require('./api/schedule/save-booking');
app.post('/api/schedule/save-booking', saveScheduleBooking);
const createScheduleMeet = require('./api/schedule/create-meet');
app.post('/api/schedule/create-meet', createScheduleMeet);
const saveSchedulePoll = require('./api/schedule/save-poll');
app.post('/api/schedule/save-poll', saveSchedulePoll);
const listStaffAvailability = require('./api/schedule/list-availability');
app.post('/api/schedule/list-availability', listStaffAvailability);
const listScheduleEvents = require('./api/schedule/list-events');
app.post('/api/schedule/list-events', listScheduleEvents);
const completeScheduleInterview = require('./api/schedule/complete-interview');
app.post('/api/schedule/complete-interview', completeScheduleInterview);
const assignScheduleParticipant = require('./api/schedule/assign-participant');
app.post('/api/schedule/assign-participant', assignScheduleParticipant);
const saveAvailability = require('./api/schedule/save-availability');
app.post('/api/schedule/save-availability', saveAvailability);
const upsertManagedUser = require('./api/admin/upsert-user');
app.post('/api/admin/upsert-user', upsertManagedUser);
const finalizeInterviewCron = require('./api/cron/finalize-interviews');
app.get('/api/cron/finalize-interviews', finalizeInterviewCron);
app.post('/api/cron/finalize-interviews', finalizeInterviewCron);


// API: Generate certificate data (for PDF generation in future)
app.post('/api/generate-certificate', async (req, res) => {
    try {
        const { userId, name, type, achievement, certId } = req.body;
        if (!userId || !name) return res.status(400).json({ error: 'Missing required fields' });
        // Generate certificate verification code
        const verificationCode = 'YNDA-' + (certId || Date.now().toString(36).toUpperCase());
        res.json({
            success: true,
            certificate: {
                id: verificationCode,
                userId,
                name,
                type: type || 'participation',
                achievement: achievement || '',
                issuedAt: new Date().toISOString(),
                verifyUrl: `https://yniemdienanh.vercel.app/verify?code=${verificationCode}`
            }
        });
    } catch (err) {
        console.error('Generate certificate error:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Admin delete user (Firebase Auth + Firestore)
const deleteUserHandler = require('./api/admin/delete-user');
app.post('/api/admin/delete-user', async (req, res) => {
    try {
        await deleteUserHandler(req, res);
    } catch (err) {
        console.error('Delete user error:', err);
        if (!res.headersSent) res.status(500).json({ error: err.message });
    }
});

app.post('/api/verify-turnstile', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ success: false, error: 'Missing token' });
        if (!TURNSTILE_SECRET_KEY) {
            return res.json({ success: true, devMode: true });
        }
        const formData = new URLSearchParams();
        formData.append('secret', TURNSTILE_SECRET_KEY);
        formData.append('response', token);
        const cfRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: formData
        });
        const cfData = await cfRes.json();
        res.json({ success: cfData.success === true });
    } catch (err) {
        console.error('Turnstile verify error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: "ok" });
});

// Homepage content API — single source of truth for AI + manual edits
const CONTENT_FILE = path.join(__dirname, 'homepage-content.json');

app.get('/api/homepage-content', (req, res) => {
    try {
        if (fs.existsSync(CONTENT_FILE)) {
            const data = fs.readFileSync(CONTENT_FILE, 'utf-8');
            res.json(JSON.parse(data));
        } else {
            res.json(null);
        }
    } catch (err) {
        console.error('Error reading homepage content file:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/homepage-content', express.json({ limit: '1mb' }), (req, res) => {
    try {
        const content = req.body;
        if (!content || typeof content !== 'object') {
            return res.status(400).json({ error: 'Invalid content' });
        }
        fs.writeFileSync(CONTENT_FILE, JSON.stringify(content, null, 2), 'utf-8');
        console.log('Homepage content saved to file');

        // Auto-commit to Git so AI can pull the latest
        try {
            const repoDir = __dirname;
            execSync('git add homepage-content.json', { cwd: repoDir, stdio: 'pipe' });
            const diff = execSync('git diff --cached --stat', { cwd: repoDir, encoding: 'utf-8', stdio: 'pipe' });
            if (diff.trim()) {
                execSync('git commit -m "auto: update homepage content [skip ci]"', { cwd: repoDir, stdio: 'pipe' });
                execSync('git push origin main', { cwd: repoDir, stdio: 'pipe' });
                console.log('Committed and pushed homepage-content.json to GitHub');
            } else {
                console.log('No changes to commit (homepage-content.json unchanged)');
            }
        } catch (gitErr) {
            console.warn('Git auto-commit/push failed (non-blocking):', gitErr.message || gitErr);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Error saving homepage content:', err);
        res.status(500).json({ error: err.message });
    }
});

// ================= SOCIAL MEDIA SYNC API =================
const socialSync = require('./api/sync/social-sync');

// GET /api/social-posts — lấy danh sách bài đã đồng bộ từ MXH
app.get('/api/social-posts', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 0;
        const platform = req.query.platform;
        let posts = socialSync.getPosts(limit);
        if (platform) posts = posts.filter(p => p.platform === platform);
        res.json({ success: true, posts });
    } catch (err) {
        console.error('Error reading social posts:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/sync/trigger — kích hoạt đồng bộ thủ công (yêu cầu admin key)
const SYNC_ADMIN_KEY = process.env.SYNC_ADMIN_KEY || '';
app.post('/api/sync/trigger', async (req, res) => {
    try {
        const auth = req.headers['x-sync-key'] || req.body?.key || '';
        if (SYNC_ADMIN_KEY && auth !== SYNC_ADMIN_KEY) {
            return res.status(403).json({ error: 'Invalid sync key' });
        }
        const syncConfig = {
            youtube: {
                enabled: !!(process.env.YT_API_KEY && (process.env.YT_CHANNEL_ID || process.env.YT_HANDLE)),
                apiKey: process.env.YT_API_KEY || '',
                channelId: process.env.YT_CHANNEL_ID || '',
                channelHandle: process.env.YT_HANDLE || '',
            },
            instagram: {
                enabled: !!(process.env.IG_ACCESS_TOKEN),
                accessToken: process.env.IG_ACCESS_TOKEN || '',
                userId: process.env.IG_USER_ID || 'me',
            },
            tiktok: {
                enabled: !!(process.env.TT_ACCESS_TOKEN && process.env.TT_OPEN_ID),
                accessToken: process.env.TT_ACCESS_TOKEN || '',
                openId: process.env.TT_OPEN_ID || '',
            },
            _db: db,
        };
        const result = await socialSync.syncAll(syncConfig);
        res.json({ success: true, ...result });
    } catch (err) {
        console.error('Sync trigger error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/sync/status — kiểm tra trạng thái cấu hình đồng bộ
app.get('/api/sync/status', (req, res) => {
    res.json({
        youtube: !!(process.env.YT_API_KEY && (process.env.YT_CHANNEL_ID || process.env.YT_HANDLE)),
        instagram: !!(process.env.IG_ACCESS_TOKEN),
        tiktok: !!(process.env.TT_ACCESS_TOKEN && process.env.TT_OPEN_ID),
        totalPosts: socialSync.getPosts().length,
    });
});

// Serve static files
app.use('/Logo', express.static(path.join(__dirname, 'Logo')));
app.use('/Kế hoạch', express.static(path.join(__dirname, 'Kế hoạch')));
app.use('/js', express.static(path.join(__dirname, 'js')));

// SPA routing fallback
app.get('/payment-success', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/payment-cancel', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/privacy', (req, res) => {
    res.sendFile(path.join(__dirname, 'privacy.html'));
});

app.get('/terms', (req, res) => {
    res.sendFile(path.join(__dirname, 'terms.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'register.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/vinh-danh', (req, res) => {
    res.sendFile(path.join(__dirname, 'vinh-danh.html'));
});

app.get('/community', (req, res) => {
    res.sendFile(path.join(__dirname, 'community.html'));
});

app.get('/verify', (req, res) => {
    res.sendFile(path.join(__dirname, 'verify.html'));
});

app.get('/schedule', (req, res) => {
    res.sendFile(path.join(__dirname, 'schedule.html'));
});

app.get('/schedule/:code', (req, res) => {
    res.sendFile(path.join(__dirname, 'schedule.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Node.js server running at ${BASE_URL}`);
    console.log(`PayOS is ${PAYOS_ENABLED ? "ENABLED" : "DISABLED (Check your env variables)"}`);

    // Auto sync every 30 minutes if any platform is configured
    const SYNC_INTERVAL = parseInt(process.env.SYNC_INTERVAL_MINUTES || '30') * 60 * 1000;
    const hasAnySync = process.env.YT_API_KEY || process.env.IG_ACCESS_TOKEN || process.env.TT_ACCESS_TOKEN;
    if (hasAnySync && SYNC_INTERVAL > 0) {
        console.log(`[SocialSync] Auto-sync enabled, running every ${SYNC_INTERVAL / 60000} minutes`);

        // Run first sync after 10 seconds delay
        setTimeout(async () => {
            try {
                const syncConfig = {
                    youtube: {
                        enabled: !!(process.env.YT_API_KEY && (process.env.YT_CHANNEL_ID || process.env.YT_HANDLE)),
                        apiKey: process.env.YT_API_KEY || '',
                        channelId: process.env.YT_CHANNEL_ID || '',
                        channelHandle: process.env.YT_HANDLE || '',
                    },
                    instagram: {
                        enabled: !!(process.env.IG_ACCESS_TOKEN),
                        accessToken: process.env.IG_ACCESS_TOKEN || '',
                        userId: process.env.IG_USER_ID || 'me',
                    },
                    tiktok: {
                        enabled: !!(process.env.TT_ACCESS_TOKEN && process.env.TT_OPEN_ID),
                        accessToken: process.env.TT_ACCESS_TOKEN || '',
                        openId: process.env.TT_OPEN_ID || '',
                    },
                    _db: db,
                };
                await socialSync.syncAll(syncConfig);
            } catch (e) { console.warn('[SocialSync] Initial sync failed:', e.message); }
        }, 10000);

        setInterval(async () => {
            try {
                const syncConfig = {
                    youtube: {
                        enabled: !!(process.env.YT_API_KEY && (process.env.YT_CHANNEL_ID || process.env.YT_HANDLE)),
                        apiKey: process.env.YT_API_KEY || '',
                        channelId: process.env.YT_CHANNEL_ID || '',
                        channelHandle: process.env.YT_HANDLE || '',
                    },
                    instagram: {
                        enabled: !!(process.env.IG_ACCESS_TOKEN),
                        accessToken: process.env.IG_ACCESS_TOKEN || '',
                        userId: process.env.IG_USER_ID || 'me',
                    },
                    tiktok: {
                        enabled: !!(process.env.TT_ACCESS_TOKEN && process.env.TT_OPEN_ID),
                        accessToken: process.env.TT_ACCESS_TOKEN || '',
                        openId: process.env.TT_OPEN_ID || '',
                    },
                    _db: db,
                };
                await socialSync.syncAll(syncConfig);
            } catch (e) { console.warn('[SocialSync] Auto sync failed:', e.message); }
        }, SYNC_INTERVAL);
    } else {
        console.log('[SocialSync] Auto-sync disabled. Set YT_API_KEY, IG_ACCESS_TOKEN, or TT_ACCESS_TOKEN to enable.');
    }
});
