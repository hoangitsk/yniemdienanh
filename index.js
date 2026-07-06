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
            const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
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
                let nextRegId = null;
                const seqRef = db.collection('config').doc('sequence');
                
                // If it is a registration, increment seq
                if (tx.type === 'registration') {
                    const seqDoc = await t.get(seqRef);
                    const currentSeq = seqDoc.exists ? (seqDoc.data().val || 100) : 100;
                    nextRegId = currentSeq + 1;
                    t.set(seqRef, { val: nextRegId });
                }

                // Get and update prize pool
                const ppRef = db.collection('config').doc('prizePool');
                const ppDoc = await t.get(ppRef);
                const currentTotal = ppDoc.exists ? (ppDoc.data().total || 0) : 0;
                const addedAmount = Math.round((tx.amount || 5000) * 0.7);
                t.set(ppRef, { total: currentTotal + addedAmount }, { merge: true });

                // Update transaction status
                t.update(txDoc.ref, { status: 'confirmed' });

                // Create registration if needed
                if (tx.type === 'registration') {
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
