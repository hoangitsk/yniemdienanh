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
    } catch (err) {
        console.error("Failed to initialize Firebase Admin in create-payment:", err);
    }
}

module.exports = async (req, res) => {
    var CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://yniemdienanh.vercel.app';
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
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
            return res.status(400).json({ error: "PayOS chưa được cấu hình. Vui lòng thiết lập biến môi trường." });
        }
        if (!db) {
            return res.status(500).json({ error: "Firebase Service Account chưa được cấu hình." });
        }

        const { idToken, type, targetId, title } = req.body;
        if (!idToken || !type || !targetId) {
            return res.status(400).json({ error: "Thiếu idToken, type hoặc targetId." });
        }

        // 1. Xác thực Firebase idToken
        let decoded;
        try {
            decoded = await admin.auth().verifyIdToken(idToken);
        } catch (authErr) {
            return res.status(401).json({ error: "Xác thực tài khoản thất bại: " + authErr.message });
        }
        const uid = decoded.uid;

        // Fetch user profile details safely
        const userDoc = await db.collection('users').doc(uid).get();
        const userName = userDoc.exists ? (userDoc.data().name || userDoc.data().displayName || decoded.name || 'Thành viên') : (decoded.name || 'Thành viên');

        let amountNum = 5000;
        let eventTitle = '';
        let submissionTitle = '';

        // 2. Kiểm tra target và phân giải giá cả
        if (type === 'registration') {
            // Đăng ký sự kiện/workshop
            const eventDoc = await db.collection('events').doc(String(targetId)).get();
            if (!eventDoc.exists) {
                return res.status(404).json({ error: "Sự kiện không tồn tại." });
            }
            const event = eventDoc.data();
            if (event.status === 'done') {
                return res.status(400).json({ error: "Đăng ký đã kết thúc cho sự kiện này." });
            }
            if (event.regDeadline && new Date(event.regDeadline) < new Date()) {
                return res.status(400).json({ error: "Đã quá hạn đăng ký cho sự kiện này." });
            }
            if (event.feeOption !== 'paid') {
                return res.status(400).json({ error: "Sự kiện này miễn phí hoặc không yêu cầu phí đăng ký." });
            }
            amountNum = event.price ? parseInt(event.price, 10) : 5000;
            eventTitle = event.title;

            // Kiểm tra trùng lặp registrations
            const regQuery = await db.collection('registrations')
                .where('userId', '==', uid)
                .where('eventId', '==', String(targetId))
                .limit(1).get();
            if (!regQuery.empty) {
                return res.status(400).json({ error: "Bạn đã đăng ký tham gia sự kiện này rồi." });
            }
        } else if (type === 'team_registration') {
            // Đăng ký thi theo đội
            const teamDoc = await db.collection('teams').doc(String(targetId)).get();
            if (!teamDoc.exists) {
                return res.status(404).json({ error: "Đội thi không tồn tại." });
            }
            const team = teamDoc.data();
            if (team.leaderId !== uid) {
                return res.status(403).json({ error: "Chỉ trưởng nhóm mới có quyền thanh toán phí đăng ký đội thi." });
            }

            // Kiểm tra xem đội đã có bài dự thi được duyệt/xác nhận chưa
            const subQuery = await db.collection('submissions')
                .where('teamId', '==', String(targetId))
                .where('status', '==', 'approved')
                .limit(1).get();
            if (!subQuery.empty) {
                return res.status(400).json({ error: "Đội thi của bạn đã đăng ký thành công rồi." });
            }

            // Đếm số thành viên trong team_members
            const membersSnap = await db.collection('team_members')
                .where('teamId', '==', String(targetId))
                .get();
            const memberCount = membersSnap.size + 1; // +1 cho trưởng nhóm
            amountNum = Math.round(memberCount * 5000 * 0.8);
            eventTitle = `Đăng ký đội ${team.name}`;
            submissionTitle = title || 'Bài dự thi';
        } else if (type === 'vote') {
            // Cổ vũ/Bình chọn cho tác phẩm
            const subDoc = await db.collection('submissions').doc(String(targetId)).get();
            if (!subDoc.exists) {
                return res.status(404).json({ error: "Tác phẩm không tồn tại." });
            }
            const submission = subDoc.data();
            submissionTitle = submission.title;

            // Kiểm tra trùng lặp vote (sử dụng cấu trúc subcollection mới)
            const voteDoc = await db.collection('submissions').doc(String(targetId)).collection('votes').doc(uid).get();
            if (voteDoc.exists) {
                return res.status(400).json({ error: "Bạn đã bình chọn cho tác phẩm này rồi." });
            }
            amountNum = 5000;
        } else if (type === 'sponsor') {
            // Tài trợ tự nguyện
            amountNum = Math.max(5000, parseInt(req.body.amount || 5000, 10));
            eventTitle = 'Đồng hành & Tài trợ dự án';
        } else {
            return res.status(400).json({ error: "Loại thanh toán không hợp lệ." });
        }

        // 3. Kiểm tra giao dịch PENDING trùng lặp trong 5 phút qua
        const fiveMinAgo = Date.now() - 5 * 60 * 1000;
        const txQuery = await db.collection('transactions')
            .where('userId', '==', uid)
            .where('type', '==', type)
            .where('status', '==', 'pending')
            .get();

        let activeTx = null;
        txQuery.forEach(doc => {
            const t = doc.data();
            if (t.createdAt && t.createdAt > fiveMinAgo) {
                if (type === 'registration' && t.eventId === String(targetId)) activeTx = { ...t, _ref: doc.ref };
                if (type === 'team_registration' && t.eventId === String(targetId)) activeTx = { ...t, _ref: doc.ref };
                if (type === 'vote' && t.submissionId === String(targetId)) activeTx = { ...t, _ref: doc.ref };
                if (type === 'sponsor') activeTx = { ...t, _ref: doc.ref };
            }
        });

        // PayOS có thể đã bị người dùng hủy nhưng webhook chưa về. Luôn hỏi PayOS
        // trước khi tái sử dụng link cũ để không khóa người dùng ở trạng thái pending.
        if (activeTx && activeTx.checkoutUrl) {
            try {
                const existingPayment = await payos.getPaymentLinkInformation(Number(activeTx.orderCode));
                const existingStatus = String(existingPayment.status || '').toUpperCase();
                if (existingStatus === 'PAID' || existingStatus === 'SUCCESS') {
                    await confirmTransaction(db, Number(activeTx.orderCode), existingPayment.amountPaid || existingPayment.amount);
                    return res.status(409).json({ error: 'Giao dịch này đã được thanh toán. Hệ thống đang cập nhật xác nhận.' });
                }
                const closedStatuses = new Set(['CANCELLED', 'CANCELED', 'EXPIRED', 'FAILED']);
                if (closedStatuses.has(existingStatus)) {
                    await activeTx._ref.set({ status: 'cancelled', cancelledAt: new Date().toISOString(), payosStatus: existingStatus }, { merge: true });
                    activeTx = null;
                } else {
                    console.log(`Returning active PayOS link for orderCode: ${activeTx.orderCode} (${existingStatus || 'PENDING'})`);
                    return res.json({ checkoutUrl: activeTx.checkoutUrl, qrCode: activeTx.qrCode, orderCode: activeTx.orderCode });
                }
            } catch (statusError) {
                // Không tạo trùng khi PayOS tạm thời không phản hồi; người dùng có thể thử lại.
                console.warn('Could not verify existing PayOS link:', statusError.message || statusError);
                return res.json({ checkoutUrl: activeTx.checkoutUrl, qrCode: activeTx.qrCode, orderCode: activeTx.orderCode });
            }
        }

        // 4. Tạo orderCode collision-resistant (16 chữ số)
        const orderNum = Number(Date.now().toString().slice(-10) + Math.floor(100000 + Math.random() * 900000));

        // Get the host of the request dynamically for success/cancel redirects
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const BASE_URL = `${protocol}://${host}`;

        const descStr = String(type === 'registration' ? `YNDA Reg ${targetId}` : type === 'team_registration' ? `YNDA Team ${targetId}` : `YNDA ${type} ${targetId}`).slice(0, 25);

        const paymentData = {
            orderCode: orderNum,
            amount: amountNum,
            description: descStr,
            cancelUrl: `${BASE_URL}/payment-cancel?orderCode=${orderNum}`,
            returnUrl: `${BASE_URL}/payment-success?orderCode=${orderNum}`
        };

        const paymentLink = await payos.createPaymentLink(paymentData);

        // 5. Tính toán ledger ID cho transaction (dùng sequence hoặc random để tránh trùng lặp)
        const seqRef = db.collection('config').doc('sequence');
        let nextId = orderNum;
        try {
            await db.runTransaction(async (t) => {
                const seqDoc = await t.get(seqRef);
                let currentSeq = seqDoc.exists ? (seqDoc.data().val || 100) : 100;
                currentSeq += 1;
                t.set(seqRef, { val: currentSeq });
                nextId = currentSeq;
            });
        } catch (e) {
            console.warn("Failed to get sequential ID for transaction, using orderCode instead:", e.message);
        }

        const newTx = {
            id: nextId,
            orderCode: orderNum,
            userId: uid,
            userName: userName,
            type: type,
            submissionId: type === 'vote' ? String(targetId) : '',
            submissionTitle: submissionTitle,
            eventId: type === 'registration' || type === 'team_registration' ? String(targetId) : '',
            eventTitle: eventTitle,
            amount: amountNum,
            status: 'pending',
            time: new Date().toISOString(),
            createdAt: Date.now(),
            checkoutUrl: paymentLink.checkoutUrl,
            qrCode: paymentLink.qrCode
        };

        // Ghi transaction vào Firestore (dùng orderCode làm docId để lookup siêu tốc)
        await db.collection('transactions').doc(String(orderNum)).set(newTx);

        res.json({
            checkoutUrl: paymentLink.checkoutUrl,
            qrCode: paymentLink.qrCode,
            orderCode: paymentLink.orderCode
        });

    } catch (err) {
        console.error('PayOS create payment error:', err.message || err);
        res.status(400).json({ error: err.message || 'Lỗi không xác định khi tạo liên kết thanh toán' });
    }
};
