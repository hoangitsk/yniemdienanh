const nodemailer = require('nodemailer');
const admin = require('firebase-admin');

// Trigger Vercel rebuild to apply new environment variables
// Initialize Firebase Admin if not already initialized
let adminInitError = null;
const FIREBASE_SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT;
if (FIREBASE_SERVICE_ACCOUNT && !admin.apps.length) {
    try {
        let serviceAccountStr = FIREBASE_SERVICE_ACCOUNT.trim();
        if (serviceAccountStr.startsWith('"') && serviceAccountStr.endsWith('"')) {
            serviceAccountStr = serviceAccountStr.slice(1, -1);
        }
        if (serviceAccountStr.includes('\\"')) {
            serviceAccountStr = serviceAccountStr.replace(/\\"/g, '"');
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
    } catch (e) {
        adminInitError = e.message || String(e);
        console.error("Firebase admin init failed:", e);
    }
}

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
    var CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://yniemdienanh.com';
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
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
        const { idToken, email } = req.body;
        if (!idToken || !email) return res.status(400).json({ error: 'Missing idToken or email' });

        // Verify idToken belongs to the claimed email (security: prevent email spoofing)
        let oobLink = null;
        let adminErrDetail = null;

        // Try using Firebase Admin SDK first (more reliable, bypasses public API key restrictions)
        if (admin.apps.length) {
            try {
                const decoded = await admin.auth().verifyIdToken(idToken);
                if (decoded.email !== email) {
                    return res.status(403).json({ error: 'Email không khớp với token.' });
                }
                oobLink = await admin.auth().generateEmailVerificationLink(email);
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
                    adminInitError: adminInitError,
                    adminAppsLength: admin.apps.length,
                    hasServiceAccountEnv: !!FIREBASE_SERVICE_ACCOUNT
                });
            }
        }

        await transporter.sendMail({
            from: `"Ý Niệm Điện Ảnh" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: 'Xác thực tài khoản Ý Niệm Điện Ảnh',
            text: `XÁC THỰC TÀI KHOẢN Ý NIỆM ĐIỆN ẢNH\n\nCảm ơn bạn đã đăng ký tại Ý Niệm Điện Ảnh!\n\nVui lòng bấm link bên dưới để xác thực email của bạn:\n${oobLink}\n\nNếu bạn không đăng ký tài khoản này, vui lòng bỏ qua email này.\n\n© ${new Date().getFullYear()} Ý Niệm Điện Ảnh — Nơi Ý Tưởng Cất Cánh`,
            html: `
                <div style="max-width:600px;margin:auto;background:#0d0d0d;padding:0;border-radius:12px;overflow:hidden;font-family:'Be Vietnam Pro',Helvetica,Arial,sans-serif">
                    <div style="background:linear-gradient(135deg,#1a1008 0%,#0d0d0d 50%,#1a1008 100%);padding:40px 30px 30px;text-align:center;border-bottom:2px solid rgba(228,184,102,0.2)">
                        <img src="https://yniemdienanh.com/Logo/logo%20ngang.png" alt="Ý Niệm Điện Ảnh" style="max-height:56px;margin-bottom:8px">
                    </div>
                    <div style="background:#0d0d0d;padding:30px 35px">
                        <div style="text-align:center;margin-bottom:28px">
                            <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#e4b866,#cc9d4f);display:inline-flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:16px;box-shadow:0 4px 20px rgba(228,184,102,0.3)">🎬</div>
                            <h2 style="color:#f3dba3;font-size:22px;margin:0 0 8px;font-weight:700;letter-spacing:0.5px">Xác thực tài khoản</h2>
                            <p style="color:#a0a0a0;font-size:14px;line-height:1.7;margin:0">Cảm ơn bạn đã đăng ký tại <strong style="color:#e4b866">Ý Niệm Điện Ảnh</strong>!<br>Bấm nút bên dưới để hoàn tất xác thực email:</p>
                        </div>
                        <div style="text-align:center;margin:28px 0">
                            <a href="${oobLink}" style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg,#e4b866,#cc9d4f);color:#0d0d0d;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;letter-spacing:0.5px;box-shadow:0 4px 15px rgba(228,184,102,0.25)">Xác thực tài khoản</a>
                        </div>
                        <p style="color:#666;font-size:12px;line-height:1.6;text-align:center;margin-top:24px">Nếu bạn không đăng ký tài khoản này, vui lòng bỏ qua email này.</p>
                    </div>
                    <div style="background:#0a0a0a;padding:20px 35px;text-align:center;border-top:1px solid rgba(228,184,102,0.08)">
                        <p style="color:#555;font-size:12px;margin:0 0 4px">© ${new Date().getFullYear()} Ý Niệm Điện Ảnh — Nơi Ý Tưởng Cất Cánh</p>
                        <p style="color:#444;font-size:11px;margin:0">Email này được gửi tự động, vui lòng không trả lời.</p>
                    </div>
                </div>
            `,
        });

        res.json({ success: true });
    } catch (err) {
        console.error('Send verification error:', err);
        res.status(500).json({ error: err.message });
    }
};
