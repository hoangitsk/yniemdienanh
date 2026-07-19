const PayOS = require('@payos/node');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { confirmTransaction } = require('../lib/paymentFulfillment');

const PAYOS_CLIENT_ID = process.env.PAYOS_CLIENT_ID || "";
const PAYOS_API_KEY = process.env.PAYOS_API_KEY || "";
const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY || "";

const PAYOS_ENABLED = !!(PAYOS_CLIENT_ID && PAYOS_API_KEY && PAYOS_CHECKSUM_KEY);
const payos = PAYOS_ENABLED ? new PayOS(PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY) : null;

const MIN_PAYMENT_AMOUNT = 1000;
const MIN_SPONSOR_AMOUNT = 5000;
const MAX_PAYMENT_AMOUNT = 100000000;
const PAYMENT_INTENT_TTL_MS = 5 * 60 * 1000;

function isProduction() {
    return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

function parsePaymentAmount(value, min = MIN_PAYMENT_AMOUNT) {
    // Amounts are integer VND. Reject coercions such as NaN, Infinity,
    // exponent strings and decimal fractions instead of silently truncating.
    if (typeof value === 'string' && !/^\d+$/.test(value.trim())) return null;
    const amount = Number(value);
    if (!Number.isSafeInteger(amount) || amount < min || amount > MAX_PAYMENT_AMOUNT) return null;
    return amount;
}

function normalizeTargetId(value) {
    const targetId = String(value == null ? '' : value).trim();
    if (!targetId || targetId.length > 128 || targetId.includes('/')) return null;
    return targetId;
}

function getPublicBaseUrl() {
    const configured = String(process.env.PUBLIC_APP_URL || '').trim();
    const fallback = isProduction()
        ? 'https://yniemdienanh.vercel.app'
        : String(process.env.BASE_URL || `http://localhost:${process.env.PORT || 24687}`).trim();
    const raw = (configured || fallback).replace(/\/+$/, '');
    let parsed;
    try {
        parsed = new URL(raw);
    } catch (_) {
        throw new Error('PUBLIC_APP_URL is invalid.');
    }
    if (parsed.username || parsed.password || !['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('PUBLIC_APP_URL is invalid.');
    }
    if (isProduction() && parsed.protocol !== 'https:') {
        throw new Error('PUBLIC_APP_URL must use HTTPS in production.');
    }
    return parsed.toString().replace(/\/+$/, '');
}

function paymentIntentKey(uid, type, targetId, amount) {
    return 'v1_' + crypto.createHash('sha256')
        .update([uid, type, targetId, amount].join('|'))
        .digest('hex');
}

function cleanText(value, fallback, maxLength = 200) {
    const text = String(value == null ? '' : value)
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return (text || fallback).slice(0, maxLength);
}

function asMillis(value) {
    if (Number.isFinite(value)) return Number(value);
    if (value && typeof value.toMillis === 'function') return value.toMillis();
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function isSafeOrderCode(value) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0;
}

async function reservePaymentIntent(db, intentRef, leaseToken, metadata) {
    const orderSequenceRef = db.collection('config').doc('paymentOrderSequence');
    const now = Date.now();

    return db.runTransaction(async transaction => {
        const intentSnap = await transaction.get(intentRef);
        const existing = intentSnap.exists ? (intentSnap.data() || {}) : {};
        const expiresAt = asMillis(existing.expiresAt);

        if (expiresAt > now && existing.status === 'ready' && existing.checkoutUrl && isSafeOrderCode(existing.orderCode)) {
            return {
                state: 'ready',
                checkoutUrl: existing.checkoutUrl,
                qrCode: existing.qrCode || '',
                orderCode: Number(existing.orderCode),
                amount: parsePaymentAmount(existing.amount)
            };
        }
        if (existing.status === 'creating' && isSafeOrderCode(existing.orderCode)) {
            if (expiresAt > now) {
                return { state: 'busy', retryAfterSeconds: Math.max(1, Math.ceil((expiresAt - now) / 1000)) };
            }
            // The process may have stopped after PayOS created the link but
            // before Firestore stored its URL. Do not allocate a second order.
            return { state: 'recovery', orderCode: Number(existing.orderCode) };
        }

        // A Firestore-allocated millisecond sequence is unique across serverless
        // instances and stays far below Number.MAX_SAFE_INTEGER.
        const sequenceSnap = await transaction.get(orderSequenceRef);
        const storedValue = sequenceSnap.exists ? Number(sequenceSnap.data().value) : 0;
        const orderCode = Math.max(
            now,
            Number.isSafeInteger(storedValue) && storedValue > 0 ? storedValue + 1 : 0
        );
        if (!isSafeOrderCode(orderCode)) throw new Error('Unable to allocate a safe payment order code.');

        const expires = now + PAYMENT_INTENT_TTL_MS;
        transaction.set(orderSequenceRef, { value: orderCode, updatedAt: now }, { merge: true });
        transaction.set(intentRef, {
            ...metadata,
            status: 'creating',
            leaseToken,
            orderCode,
            createdAt: now,
            updatedAt: now,
            expiresAt: expires
        }, { merge: true });
        return { state: 'acquired', orderCode, expiresAt: expires };
    });
}

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
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
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
            return res.status(503).json({ error: "PayOS chưa được cấu hình. Vui lòng thiết lập biến môi trường." });
        }
        if (!db) {
            return res.status(503).json({ error: "Firebase Service Account chưa được cấu hình." });
        }

        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const { idToken } = body;
        const type = String(body.type || '').trim().toLowerCase();
        const targetId = normalizeTargetId(body.targetId);
        if (!idToken || !type || !targetId) {
            return res.status(400).json({ error: "Thiếu idToken, type hoặc targetId." });
        }

        // Paid voting is retired. Votes are recorded by the trusted vote
        // endpoint, never by a payment entitlement.
        if (type === 'vote') {
            return res.status(410).json({ error: 'Bình chọn không thu phí; hãy dùng luồng bình chọn chính thức.' });
        }
        if (!['registration', 'team_registration', 'sponsor'].includes(type)) {
            return res.status(400).json({ error: 'Loại thanh toán không hợp lệ.' });
        }

        // 1. Xác thực Firebase idToken
        let decoded;
        try {
            decoded = await admin.auth().verifyIdToken(idToken);
        } catch (authErr) {
            return res.status(401).json({ error: "Xác thực tài khoản thất bại." });
        }
        if (decoded.email_verified !== true) {
            return res.status(403).json({ error: 'Tài khoản phải xác minh email trước khi thanh toán.' });
        }
        const uid = decoded.uid;

        // Fetch user profile details safely
        const userDoc = await db.collection('users').doc(uid).get();
        const userProfile = userDoc.exists ? (userDoc.data() || {}) : {};
        const userName = cleanText(userProfile.name || userProfile.displayName || decoded.name, 'Thành viên', 120);

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
            if (['done', 'closed', 'cancelled', 'canceled'].includes(String(event.status || '').toLowerCase())) {
                return res.status(400).json({ error: "Đăng ký đã kết thúc cho sự kiện này." });
            }
            const deadlineMillis = asMillis(event.regDeadline);
            if (event.regDeadline && !deadlineMillis) {
                return res.status(409).json({ error: 'Hạn đăng ký sự kiện chưa được cấu hình hợp lệ.' });
            }
            if (deadlineMillis && deadlineMillis < Date.now()) {
                return res.status(400).json({ error: "Đã quá hạn đăng ký cho sự kiện này." });
            }
            if (event.feeOption !== 'paid') {
                return res.status(400).json({ error: "Sự kiện này miễn phí hoặc không yêu cầu phí đăng ký." });
            }
            // Event-specific fee wins. Older records may omit it, so use the
            // server-managed prizePool.registrationFee compatibility value.
            const priceConfigDoc = await db.collection('config').doc('prizePool').get();
            const priceConfig = priceConfigDoc.exists ? (priceConfigDoc.data() || {}) : {};
            const configuredPrice = event.price != null && event.price !== ''
                ? event.price
                : priceConfig.registrationFee;
            amountNum = parsePaymentAmount(configuredPrice);
            if (!amountNum) {
                return res.status(409).json({ error: 'Phí đăng ký sự kiện chưa được cấu hình hợp lệ.' });
            }
            eventTitle = cleanText(event.title, `Sự kiện ${targetId}`);

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
                .limit(1).get();
            if (!subQuery.empty) {
                return res.status(400).json({ error: "Đội thi của bạn đã đăng ký thành công rồi." });
            }

            // Đếm số thành viên trong team_members
            const membersSnap = await db.collection('team_members')
                .where('teamId', '==', String(targetId))
                .get();
            const memberCount = membersSnap.size + 1; // +1 cho trưởng nhóm
            if (memberCount < 1 || memberCount > 100) {
                return res.status(409).json({ error: 'Số thành viên đội không hợp lệ.' });
            }
            const priceConfigDoc = await db.collection('config').doc('prizePool').get();
            const priceConfig = priceConfigDoc.exists ? (priceConfigDoc.data() || {}) : {};
            const baseMemberFee = parsePaymentAmount(priceConfig.registrationFee);
            amountNum = baseMemberFee && parsePaymentAmount(Math.round(memberCount * baseMemberFee * 0.8));
            if (!amountNum) {
                return res.status(409).json({ error: 'Phí đăng ký đội chưa được cấu hình hợp lệ.' });
            }
            const teamName = cleanText(team.name, `Đội ${targetId}`, 120);
            eventTitle = cleanText(`Đăng ký đội ${teamName}`, 'Đăng ký đội');
            // Never persist a client-supplied title as trusted payment data.
            submissionTitle = cleanText(
                team.submissionTitle || team.projectTitle,
                `Bài dự thi của đội ${teamName}`
            );
        } else if (type === 'sponsor') {
            // Tài trợ tự nguyện
            amountNum = parsePaymentAmount(body.amount, MIN_SPONSOR_AMOUNT);
            if (!amountNum) {
                return res.status(400).json({ error: `Số tiền tài trợ phải là số nguyên từ ${MIN_SPONSOR_AMOUNT} đến ${MAX_PAYMENT_AMOUNT} VND.` });
            }
            eventTitle = 'Đồng hành & Tài trợ dự án';
        }

        if (!parsePaymentAmount(amountNum)) {
            return res.status(409).json({ error: 'Số tiền thanh toán phía máy chủ không hợp lệ.' });
        }

        // 3. Kiểm tra giao dịch PENDING trùng lặp trong 5 phút qua
        const txQuery = await db.collection('transactions')
            .where('userId', '==', uid)
            .where('type', '==', type)
            .where('status', '==', 'pending')
            .get();

        let activeTx = null;
        txQuery.forEach(doc => {
            const t = doc.data();
            if (type === 'registration' && t.eventId === String(targetId)) activeTx = { ...t, _ref: doc.ref };
            if (type === 'team_registration' && t.eventId === String(targetId)) activeTx = { ...t, _ref: doc.ref };
            if (type === 'sponsor' && Number(t.amount) === amountNum) activeTx = { ...t, _ref: doc.ref };
        });

        // PayOS có thể đã bị người dùng hủy nhưng webhook chưa về. Luôn hỏi PayOS
        // trước khi tái sử dụng link cũ để không khóa người dùng ở trạng thái pending.
        if (activeTx && activeTx.checkoutUrl) {
            if (!isSafeOrderCode(activeTx.orderCode)) {
                return res.status(409).json({ error: 'Mã giao dịch cũ không an toàn; vui lòng liên hệ ban tổ chức để được hỗ trợ.' });
            }
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
                    return res.json({ checkoutUrl: activeTx.checkoutUrl, qrCode: activeTx.qrCode, orderCode: activeTx.orderCode, amount: activeTx.amount });
                }
            } catch (statusError) {
                // Không tạo trùng khi PayOS tạm thời không phản hồi; người dùng có thể thử lại.
                console.warn('Could not verify existing PayOS link:', statusError.message || statusError);
                return res.json({ checkoutUrl: activeTx.checkoutUrl, qrCode: activeTx.qrCode, orderCode: activeTx.orderCode, amount: activeTx.amount });
            }
        }

        // 4. Reserve one deterministic intent before contacting PayOS. This
        // closes the double-click/multi-tab window where neither request can
        // see a transaction document yet.
        const intentId = paymentIntentKey(uid, type, targetId, amountNum);
        const intentRef = db.collection('paymentIntents').doc(intentId);
        const leaseToken = crypto.randomBytes(24).toString('hex');
        const reservation = await reservePaymentIntent(db, intentRef, leaseToken, {
            userId: uid,
            userName,
            type,
            targetId: String(targetId),
            amount: amountNum,
            eventTitle,
            submissionTitle
        });
        if (reservation.state === 'ready') {
            return res.json({
                checkoutUrl: reservation.checkoutUrl,
                qrCode: reservation.qrCode,
                orderCode: reservation.orderCode,
                amount: reservation.amount || amountNum,
                reused: true
            });
        }
        if (reservation.state === 'busy') {
            res.setHeader('Retry-After', String(reservation.retryAfterSeconds));
            return res.status(409).json({
                error: 'Yêu cầu thanh toán đang được xử lý. Vui lòng thử lại sau.',
                retryAfterSeconds: reservation.retryAfterSeconds
            });
        }
        if (reservation.state === 'recovery') {
            try {
                const existingPayment = await payos.getPaymentLinkInformation(reservation.orderCode);
                const existingStatus = String(existingPayment.status || '').toUpperCase();
                if (existingStatus === 'PAID' || existingStatus === 'SUCCESS') {
                    const recoveryResult = await confirmTransaction(
                        db,
                        reservation.orderCode,
                        existingPayment.amountPaid != null ? existingPayment.amountPaid : existingPayment.amount
                    );
                    return res.status(recoveryResult.success ? 409 : 202).json({
                        error: recoveryResult.success
                            ? 'Giao dịch đã được thanh toán và ghi nhận.'
                            : 'Giao dịch đã thanh toán đang chờ hệ thống ghi nhận.',
                        fulfillmentPending: !recoveryResult.success
                    });
                }
                if (['CANCELLED', 'CANCELED', 'EXPIRED', 'FAILED'].includes(existingStatus)) {
                    await db.runTransaction(async transaction => {
                        const lockedIntent = await transaction.get(intentRef);
                        const locked = lockedIntent.exists ? (lockedIntent.data() || {}) : {};
                        if (locked.status === 'creating' && Number(locked.orderCode) === reservation.orderCode) {
                            transaction.set(intentRef, {
                                status: 'cancelled',
                                payosStatus: existingStatus,
                                updatedAt: Date.now()
                            }, { merge: true });
                        }
                    });
                    return res.status(409).json({ error: 'Liên kết thanh toán cũ đã đóng. Vui lòng gửi lại yêu cầu.' });
                }
                if (typeof existingPayment.checkoutUrl === 'string' && existingPayment.checkoutUrl) {
                    return res.json({
                        checkoutUrl: existingPayment.checkoutUrl,
                        qrCode: existingPayment.qrCode || '',
                        orderCode: reservation.orderCode,
                        amount: amountNum,
                        recovered: true
                    });
                }
            } catch (recoveryError) {
                console.warn('Could not recover an interrupted PayOS link:', recoveryError.message || recoveryError);
            }
            return res.status(409).json({
                error: 'Một yêu cầu thanh toán trước đó chưa xác định được trạng thái. Không tạo thêm giao dịch để tránh thu phí trùng; vui lòng liên hệ ban tổ chức.'
            });
        }

        const orderNum = reservation.orderCode;
        const BASE_URL = getPublicBaseUrl();

        const descStr = String(type === 'registration' ? `YNDA Reg ${targetId}` : type === 'team_registration' ? `YNDA Team ${targetId}` : `YNDA ${type} ${targetId}`).slice(0, 25);

        const paymentData = {
            orderCode: orderNum,
            amount: amountNum,
            description: descStr,
            cancelUrl: `${BASE_URL}/payment-cancel?orderCode=${orderNum}`,
            returnUrl: `${BASE_URL}/payment-success?orderCode=${orderNum}`
        };

        let paymentLink;
        try {
            paymentLink = await payos.createPaymentLink(paymentData);
        } catch (paymentError) {
            paymentError.statusCode = 502;
            throw paymentError;
        }
        if (!paymentLink || typeof paymentLink.checkoutUrl !== 'string' || !paymentLink.checkoutUrl) {
            const paymentError = new Error('PayOS did not return a checkout URL.');
            paymentError.statusCode = 502;
            throw paymentError;
        }

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
            submissionId: '',
            submissionTitle: submissionTitle,
            eventId: type === 'registration' || type === 'team_registration' ? String(targetId) : '',
            eventTitle: eventTitle,
            amount: amountNum,
            status: 'pending',
            time: new Date().toISOString(),
            createdAt: Date.now(),
            paymentIntentId: intentId,
            pricingSource: type === 'sponsor' ? 'validated-user-choice' : 'firestore',
            checkoutUrl: paymentLink.checkoutUrl,
            qrCode: paymentLink.qrCode || ''
        };

        // Persist the transaction and publish the reusable intent in one atomic
        // Firestore transaction. A lost response can then be retried safely.
        const transactionRef = db.collection('transactions').doc(String(orderNum));
        await db.runTransaction(async transaction => {
            const lockedIntent = await transaction.get(intentRef);
            const existingTransaction = await transaction.get(transactionRef);
            const intent = lockedIntent.exists ? (lockedIntent.data() || {}) : {};
            if (intent.leaseToken !== leaseToken || Number(intent.orderCode) !== orderNum) {
                throw new Error('Payment intent lease was lost.');
            }
            if (existingTransaction.exists) {
                throw new Error('Payment order code already exists.');
            }
            const now = Date.now();
            transaction.set(transactionRef, newTx);
            transaction.set(intentRef, {
                status: 'ready',
                orderCode: orderNum,
                checkoutUrl: paymentLink.checkoutUrl,
                qrCode: paymentLink.qrCode || '',
                updatedAt: now,
                expiresAt: now + PAYMENT_INTENT_TTL_MS
            }, { merge: true });
        });

        res.json({
            checkoutUrl: paymentLink.checkoutUrl,
            qrCode: paymentLink.qrCode || '',
            orderCode: orderNum,
            amount: amountNum
        });

    } catch (err) {
        console.error('PayOS create payment error:', err.message || err);
        const statusCode = Number.isInteger(err.statusCode) && err.statusCode >= 400 && err.statusCode <= 599
            ? err.statusCode
            : 500;
        const message = statusCode === 502
            ? 'Không thể kết nối cổng thanh toán. Vui lòng thử lại sau.'
            : 'Không thể tạo liên kết thanh toán. Vui lòng thử lại sau.';
        res.status(statusCode).json({ error: message });
    }
};
