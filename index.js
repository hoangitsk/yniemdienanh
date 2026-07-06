const express = require('express');
const cors = require('cors');
const path = require('path');
const PayOS = require('@payos/node');
const nodemailer = require('nodemailer');
const admin = require('firebase-admin');
require('dotenv').config();

const PAYOS_CLIENT_ID = process.env.PAYOS_CLIENT_ID || "";
const PAYOS_API_KEY = process.env.PAYOS_API_KEY || "";
const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY || "";

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

// Email API endpoints
app.post('/api/email/send-verification', async (req, res) => {
    try {
        const { idToken, email } = req.body;
        if (!idToken || !email) return res.status(400).json({ error: 'Missing idToken or email' });

        let oobLink = null;
        let adminErrDetail = null;

        // Try using Firebase Admin SDK first
        if (admin.apps.length && db) {
            try {
                oobLink = await admin.auth().generateEmailVerificationLink(email);
                console.log('Admin SDK generated verification link for', email);
            } catch (adminErr) {
                adminErrDetail = adminErr.message || String(adminErr);
                console.warn('Firebase Admin generate link failed, falling back:', adminErr.message || adminErr);
            }
        }

        // Fallback to public Identity Toolkit REST API
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

        await transporter.sendMail({
            from: `"Ý Niệm Điện Ảnh" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: 'Đặt lại mật khẩu Ý Niệm Điện Ảnh',
            text: `ĐẶT LẠI MẬT KHẨU Ý NIỆM ĐIỆN ẢNH\n\nBạn vừa yêu cầu đặt lại mật khẩu cho tài khoản Ý Niệm Điện Ảnh.\n\nBấm link bên dưới để tạo mật khẩu mới:\n${oobLink}\n\nNếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.\n\n© ${new Date().getFullYear()} Ý Niệm Điện Ảnh — Nơi Ý Tưởng Cất Cánh`,
            html: `
                <div style="max-width:600px;margin:auto;background:#0d0d0d;padding:0;border-radius:12px;overflow:hidden;font-family:'Be Vietnam Pro',Helvetica,Arial,sans-serif">
                    <div style="background:linear-gradient(135deg,#1a1008 0%,#0d0d0d 50%,#1a1008 100%);padding:40px 30px 30px;text-align:center;border-bottom:2px solid rgba(228,184,102,0.2)">
                        <img src="https://yniemdienanh.com/Logo/logo%20ngang.png" alt="Ý Niệm Điện Ảnh" style="max-height:56px;margin-bottom:8px">
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
                        <p style="color:#666;font-size:12px;line-height:1.6;text-align:center;margin-top:24px">Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
                    </div>
                    <div style="background:#0a0a0a;padding:20px 35px;text-align:center;border-top:1px solid rgba(228,184,102,0.08)">
                        <p style="color:#555;font-size:12px;margin:0 0 4px">© ${new Date().getFullYear()} Ý Niệm Điện Ảnh — Nơi Ý Tưởng Cất Cánh</p>
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

// PayOS API endpoints (replacing Python FastAPI backend)
app.post('/api/create-payment', async (req, res) => {
    try {
        if (!PAYOS_ENABLED) {
            return res.status(400).json({ error: "PayOS chưa được cấu hình. Vui lòng thiết lập biến môi trường." });
        }

        const { amount, description, orderCode } = req.body;
        const amountNum = parseInt(amount || 5000, 10);
        const descStr = String(description || "Thanh toan").substring(0, 25);
        const orderNum = parseInt(orderCode || Math.floor(Date.now() % 100000000), 10);

        const paymentData = {
            orderCode: orderNum,
            amount: amountNum,
            description: descStr,
            cancelUrl: `${BASE_URL}/payment-cancel?orderCode=${orderNum}`,
            returnUrl: `${BASE_URL}/payment-success?orderCode=${orderNum}`
        };

        const paymentLink = await payos.createPaymentLink(paymentData);
        res.json({
            checkoutUrl: paymentLink.checkoutUrl,
            qrCode: paymentLink.qrCode,
            orderCode: paymentLink.orderCode
        });
    } catch (err) {
        console.error('PayOS create payment error:', err);
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/payos-webhook', async (req, res) => {
    try {
        if (!PAYOS_ENABLED) {
            return res.status(400).json({ error: "PayOS chưa được cấu hình." });
        }

        const webhookData = payos.verifyPaymentWebhookData(req.body);
        const orderNum = Number(webhookData.orderCode);
        console.log('PayOS Webhook received & verified. OrderCode:', orderNum, 'Amount:', webhookData.amount);

        // Update database if Firebase is initialized
        if (db) {
            const txQuery = await db.collection('transactions').where('orderCode', '==', orderNum).limit(1).get();
            
            if (txQuery.empty) {
                console.warn('Transaction not found in database for orderCode:', orderNum);
                return res.json({ success: true, warning: 'Transaction not found in database' });
            }

            const txDoc = txQuery.docs[0];
            const tx = txDoc.data();

            if (tx.status === 'confirmed') {
                console.log(`Transaction for orderCode ${orderNum} is already confirmed.`);
                return res.json({ success: true, message: 'Already confirmed' });
            }

            // Perform transaction to update status and other tables
            await db.runTransaction(async (t) => {
                const seqRef = db.collection('config').doc('sequence');
                const ppRef = db.collection('config').doc('prizePool');

                // 1. Thực hiện toàn bộ lệnh READ trước
                const seqDoc = await t.get(seqRef);
                const ppDoc = await t.get(ppRef);

                // 2. Tính toán và thực hiện toàn bộ lệnh WRITE sau
                let currentSeq = seqDoc.exists ? (seqDoc.data().val || 100) : 100;
                
                let nextRegId = null;
                if (tx.type === 'registration') {
                    currentSeq = currentSeq + 1;
                    nextRegId = currentSeq;
                    // Tạo đăng ký mới
                    const regRef = db.collection('registrations').doc(String(nextRegId));
                    const newReg = {
                        id: nextRegId,
                        userId: tx.userId,
                        userName: tx.userName,
                        eventId: tx.eventId,
                        eventTitle: tx.eventTitle,
                        time: tx.time
                    };
                    t.set(regRef, newReg);
                }

                // Tự động ghi chép vào Số tay tài chính (budget)
                currentSeq = currentSeq + 1;
                const budgetId = currentSeq;
                
                let label = '';
                if (tx.type === 'registration') {
                    label = `Thu phí đăng ký: ${tx.eventTitle || tx.eventId} - ${tx.userName}`;
                } else if (tx.type === 'vote') {
                    label = `Thu phí bình chọn: MS ${tx.submissionTitle || tx.submissionId} - ${tx.userName}`;
                } else {
                    label = `Nhận tài trợ: Gói ủng hộ - ${tx.userName}`;
                }
                
                const budgetRef = db.collection('budget').doc(String(budgetId));
                const newLedger = {
                    id: budgetId,
                    type: 'in',
                    label: label,
                    amount: tx.amount || 5000,
                    date: new Date().toISOString().slice(0, 10)
                };
                t.set(budgetRef, newLedger);

                // Cập nhật lại số sequence cuối cùng
                t.set(seqRef, { val: currentSeq });

                // Cập nhật prize pool
                const currentTotal = ppDoc.exists ? (ppDoc.data().total || 0) : 0;
                const addedAmount = Math.round((tx.amount || 5000) * 0.7);
                t.set(ppRef, { total: currentTotal + addedAmount }, { merge: true });

                // Cập nhật trạng thái giao dịch
                t.update(txDoc.ref, { status: 'confirmed' });
            });

            console.log(`Database updated successfully for orderCode ${orderNum}.`);
        } else {
            console.warn('Database update skipped because Firebase Admin is not initialized.');
        }

        res.json({ success: true });
    } catch (err) {
        console.error('PayOS webhook verification error:', err);
        res.status(400).json({ error: err.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: "ok" });
});


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
    console.log(`PayOS is ${PAYOS_ENABLED ? "ENABLED" : "DISABLED (Check your env variables)"}`);
});
