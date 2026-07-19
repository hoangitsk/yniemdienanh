const PayOS = require('@payos/node');
const admin = require('firebase-admin');
const { confirmTransaction } = require('../lib/paymentFulfillment');

const PAYOS_CLIENT_ID = process.env.PAYOS_CLIENT_ID || '';
const PAYOS_API_KEY = process.env.PAYOS_API_KEY || '';
const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY || '';
const PAYOS_ENABLED = Boolean(PAYOS_CLIENT_ID && PAYOS_API_KEY && PAYOS_CHECKSUM_KEY);
const payos = PAYOS_ENABLED ? new PayOS(PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY) : null;
const DEFAULT_PROJECT_ADMIN_EMAIL = 'yniemdienanh@gmail.com';

function httpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function parseServiceAccount(raw) {
    if (!raw || typeof raw !== 'string') throw httpError(503, 'Firebase Admin chưa được cấu hình.');
    let value = raw.trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    let account = JSON.parse(value);
    if (typeof account === 'string') account = JSON.parse(account);
    if (!account || !account.project_id || !account.client_email || !account.private_key) {
        throw httpError(503, 'Firebase Admin chưa được cấu hình hợp lệ.');
    }
    account.private_key = account.private_key.replace(/\\n/g, '\n');
    return account;
}

function ensureFirestore() {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT))
        });
    }
    return admin.firestore();
}

function tokenFromRequest(req) {
    const authorization = req.headers && (req.headers.authorization || req.headers.Authorization);
    if (typeof authorization === 'string') {
        const match = authorization.match(/^Bearer\s+(.+)$/i);
        if (match && match[1].trim()) return match[1].trim();
    }
    const bodyToken = req.body && req.body.idToken;
    return typeof bodyToken === 'string' ? bodyToken.trim() : '';
}

function parseOrderCode(value) {
    const raw = String(value == null ? '' : value).trim();
    if (!/^\d{1,16}$/.test(raw)) return null;
    const orderCode = Number(raw);
    return Number.isSafeInteger(orderCode) && orderCode > 0 ? orderCode : null;
}

function managerEmails() {
    return new Set([
        DEFAULT_PROJECT_ADMIN_EMAIL,
        ...String(process.env.PAYMENT_MANAGER_EMAILS || '').split(',')
    ].map(email => email.trim().toLowerCase()).filter(Boolean));
}

function isPaymentManager(decoded, profile) {
    const email = String(decoded.email || '').trim().toLowerCase();
    const tokenRole = String(decoded.role || '').trim().toLowerCase();
    const profileRole = String(profile.role || '').trim().toLowerCase();
    return managerEmails().has(email)
        || decoded.admin === true
        || tokenRole === 'admin'
        || profileRole === 'admin';
}

async function findTransaction(db, orderCode) {
    const direct = await db.collection('transactions').doc(String(orderCode)).get();
    if (direct.exists) return direct;

    // Compatibility for legacy documents whose id was a separate ledger id.
    const numericMatch = await db.collection('transactions')
        .where('orderCode', '==', orderCode)
        .limit(1)
        .get();
    if (!numericMatch.empty) return numericMatch.docs[0];

    const stringMatch = await db.collection('transactions')
        .where('orderCode', '==', String(orderCode))
        .limit(1)
        .get();
    return stringMatch.empty ? null : stringMatch.docs[0];
}

module.exports = async (req, res) => {
    const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://yniemdienanh.vercel.app';
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Origin');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const db = ensureFirestore();
        const idToken = tokenFromRequest(req);
        if (!idToken) throw httpError(401, 'Thiếu thông tin xác thực.');

        let decoded;
        try {
            decoded = await admin.auth().verifyIdToken(idToken);
        } catch (authError) {
            throw httpError(401, 'Xác thực tài khoản thất bại.');
        }
        if (decoded.email_verified !== true) {
            throw httpError(403, 'Tài khoản phải xác minh email trước khi kiểm tra thanh toán.');
        }

        const orderCode = parseOrderCode(req.query && req.query.orderCode);
        if (!orderCode) throw httpError(400, 'orderCode không hợp lệ.');

        // Authorization is resolved against the canonical transaction before
        // any PayOS request, preventing a public payment-status oracle.
        const transactionDoc = await findTransaction(db, orderCode);
        if (!transactionDoc) throw httpError(404, 'Không tìm thấy giao dịch.');
        const transaction = transactionDoc.data() || {};
        const isOwner = String(transaction.userId || '') === String(decoded.uid || '');
        if (!isOwner) {
            const profileDoc = await db.collection('users').doc(String(decoded.uid)).get();
            const profile = profileDoc.exists ? (profileDoc.data() || {}) : {};
            if (!isPaymentManager(decoded, profile)) {
                throw httpError(403, 'Bạn không có quyền kiểm tra giao dịch này.');
            }
        }

        // A canonical confirmed record is authoritative and remains available
        // even during a temporary PayOS outage.
        if (String(transaction.status || '').toLowerCase() === 'confirmed') {
            return res.json({
                success: true,
                orderCode,
                status: 'PAID',
                paid: true,
                dbConfirmed: true,
                source: 'database'
            });
        }

        if (!PAYOS_ENABLED) throw httpError(503, 'PayOS chưa được cấu hình.');

        let payment;
        try {
            payment = await payos.getPaymentLinkInformation(orderCode);
        } catch (paymentError) {
            console.error('PayOS payment-status lookup failed:', paymentError.message || paymentError);
            throw httpError(502, 'Không thể kết nối cổng thanh toán. Vui lòng thử lại sau.');
        }

        const status = String(payment.status || '').toUpperCase();
        const paid = status === 'PAID' || status === 'SUCCESS';
        let dbConfirmed = false;
        if (paid) {
            const paidAmount = payment.amountPaid != null ? payment.amountPaid : payment.amount;
            const fulfillResult = await confirmTransaction(db, orderCode, paidAmount);
            dbConfirmed = fulfillResult.success === true;
        }

        return res.status(paid && !dbConfirmed ? 202 : 200).json({
            success: true,
            orderCode,
            status,
            paid,
            dbConfirmed,
            fulfillmentPending: paid && !dbConfirmed,
            source: 'payos'
        });
    } catch (error) {
        const statusCode = Number.isInteger(error.statusCode) && error.statusCode >= 400 && error.statusCode <= 599
            ? error.statusCode
            : 500;
        if (statusCode >= 500 && statusCode !== 502) {
            console.error('Payment status error:', error.message || error);
        }
        const message = statusCode === 500
            ? 'Không thể kiểm tra trạng thái thanh toán. Vui lòng thử lại sau.'
            : error.message;
        return res.status(statusCode).json({ error: message });
    }
};
