const express = require('express');
const cors = require('cors');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 24687;
const PYTHON_PORT = process.env.PYTHON_PORT || 8000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Gmail SMTP transporter
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASS,
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

// Email API endpoints (defined BEFORE proxy to avoid being forwarded to Python)
app.post('/api/email/send-verification', async (req, res) => {
    try {
        const { idToken, email } = req.body;
        if (!idToken || !email) return res.status(400).json({ error: 'Missing idToken or email' });

        const fbData = await fbFetch({ requestType: 'VERIFY_EMAIL', idToken, returnOobLink: true });
        if (!fbData.oobLink) {
            console.error('Firebase OOB error:', JSON.stringify(fbData));
            return res.status(500).json({ error: 'Firebase OOB link failed', detail: fbData });
        }

        await transporter.sendMail({
            from: `"Ý Niệm Điện Ảnh" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: 'Xác thực tài khoản Ý Niệm Điện Ảnh',
            html: `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #e0e0e0;border-radius:8px">
                    <h2 style="color:#d4380d">Xác thực tài khoản</h2>
                    <p>Cảm ơn bạn đã đăng ký tại <strong>Ý Niệm Điện Ảnh</strong>!</p>
                    <p>Vui lòng bấm nút bên dưới để xác thực email của bạn:</p>
                    <a href="${fbData.oobLink}" style="display:inline-block;padding:12px 24px;background:#d4380d;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold">Xác thực tài khoản</a>
                    <p style="margin-top:20px;font-size:13px;color:#888">Nếu bạn không đăng ký, vui lòng bỏ qua email này.</p>
                </div>
            `,
        });

        console.log('Verification email sent to', email);
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

        const fbData = await fbFetch({ requestType: 'PASSWORD_RESET', email, returnOobLink: true });
        if (!fbData.oobLink) {
            console.error('Firebase OOB error:', JSON.stringify(fbData));
            return res.status(500).json({ error: 'Firebase OOB link failed', detail: fbData });
        }

        await transporter.sendMail({
            from: `"Ý Niệm Điện Ảnh" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: 'Đặt lại mật khẩu Ý Niệm Điện Ảnh',
            html: `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #e0e0e0;border-radius:8px">
                    <h2 style="color:#d4380d">Đặt lại mật khẩu</h2>
                    <p>Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản <strong>Ý Niệm Điện Ảnh</strong>.</p>
                    <p>Bấm nút bên dưới để tạo mật khẩu mới:</p>
                    <a href="${fbData.oobLink}" style="display:inline-block;padding:12px 24px;background:#d4380d;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold">Đặt lại mật khẩu</a>
                    <p style="margin-top:20px;font-size:13px;color:#888">Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
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

// Proxy /api/* and /health to Python backend
app.use('/api', createProxyMiddleware({ target: `http://localhost:${PYTHON_PORT}`, changeOrigin: true }));
app.use('/health', createProxyMiddleware({ target: `http://localhost:${PYTHON_PORT}`, changeOrigin: true }));

// Serve static files
app.use('/Logo', express.static(path.join(__dirname, 'Logo')));
app.use('/Kế hoạch', express.static(path.join(__dirname, 'Kế hoạch')));

// SPA routing fallback
app.get('/payment-success', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/payment-cancel', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Node.js server running at ${BASE_URL}`);
    console.log(`Proxying /api/* to Python backend at http://localhost:${PYTHON_PORT}`);
});
