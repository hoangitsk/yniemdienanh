const PayOS = require('@payos/node');
const admin = require('firebase-admin');
const { confirmTransaction } = require('../lib/paymentFulfillment');

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
            if (typeof serviceAccount === 'string') serviceAccount = JSON.parse(serviceAccount);
            if (serviceAccount.private_key) serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
            admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        }
        db = admin.firestore();
    } catch (err) {
        console.error('Failed to initialize Firebase Admin in payment-status:', err);
    }
}

module.exports = async (req, res) => {
    const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://yniemdienanh.vercel.app';
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        if (!PAYOS_ENABLED) return res.status(400).json({ error: 'PayOS chưa được cấu hình.' });
        const orderNum = Number(req.query.orderCode);
        if (!Number.isFinite(orderNum)) return res.status(400).json({ error: 'orderCode không hợp lệ.' });

        // Retrieve transaction status from PayOS
        const payment = await payos.getPaymentLinkInformation(orderNum);
        const status = String(payment.status || '').toUpperCase();
        const paid = status === 'PAID' || status === 'SUCCESS';

        let dbConfirmed = false;
        if (paid) {
            // Fulfill the transaction on the database
            const fulfillResult = await confirmTransaction(db, orderNum, payment.amountPaid || payment.amount);
            dbConfirmed = fulfillResult.success;
        }

        res.json({ success: true, orderCode: orderNum, status, paid, dbConfirmed });
    } catch (err) {
        console.error('PayOS payment-status error:', err.message || err);
        res.status(400).json({ error: err.message || 'Lỗi kiểm tra trạng thái thanh toán' });
    }
};
