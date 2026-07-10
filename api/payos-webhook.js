const PayOS = require('@payos/node');
const admin = require('firebase-admin');

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
        console.log("Firebase Admin initialized successfully in Webhook.");
    } catch (err) {
        console.error("Failed to initialize Firebase Admin in Webhook:", err);
    }
} else {
    console.warn("FIREBASE_SERVICE_ACCOUNT environment variable is not defined. Webhook will verify payments but cannot update database.");
}

module.exports = async (req, res) => {
    var CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://yniemdienanh.vercel.app';
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
        if (!PAYOS_ENABLED) {
            return res.status(400).json({ error: "PayOS chưa được cấu hình." });
        }

        // Verify webhook signature
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
        console.error('PayOS webhook error:', err);
        res.status(400).json({ error: err.message });
    }
};
