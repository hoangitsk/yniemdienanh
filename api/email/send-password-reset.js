const nodemailer = require('nodemailer');

const FIREBASE_API_KEY = 'AIzaSyBCDm2B4jkFJ-B62aOpVar9uxXlVxT3QDQ';
const FIREBASE_AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`;

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASS,
    },
});

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

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

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

        res.json({ success: true });
    } catch (err) {
        console.error('Send password reset error:', err);
        res.status(500).json({ error: err.message });
    }
};
