const PayOS = require('@payos/node');
const admin = require('firebase-admin');

const PAYOS_CLIENT_ID = process.env.PAYOS_CLIENT_ID || "";
const PAYOS_API_KEY = process.env.PAYOS_API_KEY || "";
const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY || "";
const PAYOS_ENABLED = !!(PAYOS_CLIENT_ID && PAYOS_API_KEY && PAYOS_CHECKSUM_KEY);
const payos = PAYOS_ENABLED ? new PayOS(PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY) : null;

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

async function confirmTransaction(orderNum) {
    if (!db) return false;
    const txQuery = await db.collection('transactions').where('orderCode', '==', orderNum).limit(1).get();
    if (txQuery.empty) return false;
    const txDoc = txQuery.docs[0];
    const tx = txDoc.data();
    if (tx.status === 'confirmed') return true;

    await db.runTransaction(async (t) => {
        const seqRef = db.collection('config').doc('sequence');
        const ppRef = db.collection('config').doc('prizePool');
        const seqDoc = await t.get(seqRef);
        const ppDoc = await t.get(ppRef);
        let currentSeq = seqDoc.exists ? (seqDoc.data().val || 100) : 100;

        if (tx.type === 'registration') {
            currentSeq += 1;
            t.set(db.collection('registrations').doc(String(currentSeq)), {
                id: currentSeq,
                userId: tx.userId,
                userName: tx.userName,
                eventId: tx.eventId,
                eventTitle: tx.eventTitle,
                time: tx.time
            });
        }

        currentSeq += 1;
        let label = '';
        if (tx.type === 'registration') label = `Thu phí đăng ký: ${tx.eventTitle || tx.eventId} - ${tx.userName}`;
        else if (tx.type === 'vote') label = `Thu phí bình chọn: MS ${tx.submissionTitle || tx.submissionId} - ${tx.userName}`;
        else label = `Nhận tài trợ: Gói ủng hộ - ${tx.userName}`;

        t.set(db.collection('budget').doc(String(currentSeq)), {
            id: currentSeq,
            type: 'in',
            label,
            amount: tx.amount || 5000,
            date: new Date().toISOString().slice(0, 10)
        });
        t.set(seqRef, { val: currentSeq });
        t.set(ppRef, { total: (ppDoc.exists ? (ppDoc.data().total || 0) : 0) + Math.round((tx.amount || 5000) * 0.7) }, { merge: true });
        t.update(txDoc.ref, { status: 'confirmed' });
    });
    return true;
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

        const payment = await payos.getPaymentLinkInformation(orderNum);
        const status = String(payment.status || '').toUpperCase();
        const paid = status === 'PAID' || status === 'SUCCESS';
        const dbConfirmed = paid ? await confirmTransaction(orderNum) : false;
        res.json({ success: true, orderCode: orderNum, status, paid, dbConfirmed });
    } catch (err) {
        console.error('PayOS payment-status error:', err);
        res.status(400).json({ error: err.message });
    }
};
