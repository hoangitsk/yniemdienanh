const admin = require('firebase-admin');
const crypto = require('crypto');

const MAX_AMOUNT = 100000000;

function asSafeAmount(value) {
    const amount = Number(value);
    return Number.isSafeInteger(amount) && amount > 0 && amount <= MAX_AMOUNT ? amount : null;
}

function error(message, statusCode = 400) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}

async function recoverTransactionFromIntent(db, orderCode, paidAmount) {
    const intents = await db.collection('paymentIntents')
        .where('orderCode', '==', orderCode)
        .limit(1)
        .get();
    if (intents.empty) return null;

    const intentRef = intents.docs[0].ref;
    const txRef = db.collection('transactions').doc(String(orderCode));
    await db.runTransaction(async transaction => {
        const [intentSnap, txSnap] = await Promise.all([
            transaction.get(intentRef),
            transaction.get(txRef)
        ]);
        if (txSnap.exists) return;
        if (!intentSnap.exists) throw error('Payment intent not found', 404);

        const intent = intentSnap.data() || {};
        const amount = asSafeAmount(intent.amount);
        const type = String(intent.type || '');
        const targetId = String(intent.targetId || '');
        if (Number(intent.orderCode) !== orderCode || amount !== paidAmount) {
            throw error('Payment intent data mismatch', 409);
        }
        if (!['registration', 'team_registration', 'sponsor'].includes(type) || !intent.userId || !targetId) {
            throw error('Payment intent is incomplete', 409);
        }

        const now = new Date().toISOString();
        transaction.create(txRef, {
            id: orderCode,
            orderCode,
            userId: String(intent.userId),
            userName: String(intent.userName || 'Thành viên'),
            type,
            submissionId: '',
            submissionTitle: String(intent.submissionTitle || ''),
            eventId: type === 'sponsor' ? '' : targetId,
            eventTitle: String(intent.eventTitle || ''),
            amount,
            status: 'pending',
            time: now,
            createdAt: Date.now(),
            paymentIntentId: intentRef.id,
            recoveredFromIntent: true
        });
        transaction.set(intentRef, {
            status: 'payment_detected',
            recoveredAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    });
    return txRef.get();
}

/**
 * Fulfil a PayOS transaction exactly once.
 *
 * The transaction document and a deterministic fulfillment marker are read in
 * the same Firestore transaction as all entitlement/budget writes. This makes
 * webhook + browser-poll races converge on one result instead of creating
 * duplicate registrations, certificates, or ledger entries.
 */
async function confirmTransaction(db, orderNum, amountPaid) {
    if (!db) return { success: false, message: 'Firebase Admin not initialized' };
    const orderCode = Number(orderNum);
    const paidAmount = asSafeAmount(amountPaid);
    if (!Number.isSafeInteger(orderCode) || orderCode <= 0 || !paidAmount) {
        return { success: false, message: 'Invalid payment data' };
    }

    // New transactions use orderCode as document id. Keep a query fallback for
    // records created by the previous implementation.
    let txDoc = await db.collection('transactions').doc(String(orderCode)).get();
    if (!txDoc.exists) {
        const legacy = await db.collection('transactions').where('orderCode', '==', orderCode).limit(1).get();
        txDoc = legacy.empty
            ? await recoverTransactionFromIntent(db, orderCode, paidAmount)
            : legacy.docs[0];
        if (!txDoc || !txDoc.exists) {
            console.warn(`[Payment] Transaction not found for orderCode: ${orderCode}`);
            return { success: false, message: 'Transaction not found in database' };
        }
    }
    const initialTx = txDoc.data() || {};
    if (initialTx.status === 'confirmed') return { success: true, message: 'Already confirmed' };
    if (initialTx.type === 'vote') return { success: false, message: 'Paid voting is disabled' };

    const expectedAmount = asSafeAmount(initialTx.amount);
    if (!expectedAmount || expectedAmount !== paidAmount) {
        console.error(`[Payment] Amount mismatch for order ${orderCode}: Expected ${initialTx.amount}, got ${amountPaid}`);
        return { success: false, message: 'Transaction amount mismatch' };
    }

    const txRef = txDoc.ref;
    const markerRef = db.collection('payment_fulfillments').doc(String(orderCode));
    const entitlementKey = initialTx.type === 'registration'
        ? ['registration', initialTx.userId, initialTx.eventId].join('|')
        : initialTx.type === 'team_registration'
            ? ['team_registration', initialTx.eventId].join('|')
            : '';
    const entitlementRef = entitlementKey
        ? db.collection('payment_entitlements').doc(crypto.createHash('sha256').update(entitlementKey).digest('hex'))
        : null;
    const seqRef = db.collection('config').doc('sequence');
    const prizePoolRef = db.collection('config').doc('prizePool');
    const now = new Date().toISOString();

    try {
        const result = await db.runTransaction(async transaction => {
            // Every read is deliberately completed before the first write.
            const lockedTxSnap = await transaction.get(txRef);
            if (!lockedTxSnap.exists) throw error('Transaction not found in database', 404);
            const tx = lockedTxSnap.data() || {};
            if (tx.status === 'confirmed') return { alreadyConfirmed: true };
            if (tx.status && tx.status !== 'pending') throw error('Transaction is not pending', 409);

            const markerSnap = await transaction.get(markerRef);
            if (markerSnap.exists) return { alreadyConfirmed: true };
            const entitlementSnap = entitlementRef ? await transaction.get(entitlementRef) : null;
            const duplicateEntitlement = Boolean(entitlementSnap && entitlementSnap.exists);
            const seqSnap = await transaction.get(seqRef);
            const prizePoolSnap = await transaction.get(prizePoolRef);

            let memberRecords = [];
            const userNames = {};
            if (tx.type === 'team_registration') {
                const membersSnap = await transaction.get(
                    db.collection('team_members').where('teamId', '==', String(tx.eventId || ''))
                );
                memberRecords = membersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const ids = [...new Set([tx.userId, ...memberRecords.map(member => member.userId)].filter(Boolean))];
                for (const uid of ids) {
                    const userSnap = await transaction.get(db.collection('users').doc(String(uid)));
                    userNames[uid] = userSnap.exists
                        ? (userSnap.data().name || userSnap.data().displayName || 'Thành viên')
                        : 'Thành viên';
                }
            }

            let currentSeq = Number(seqSnap.exists && seqSnap.data().val) || 100;
            const nextId = () => { currentSeq += 1; return currentSeq; };
            const teamName = String(tx.eventTitle || '').replace(/^Đăng ký đội\s*/i, '') || 'Đội thi';

            if (tx.type === 'registration' && !duplicateEntitlement) {
                const id = nextId();
                const registrationRef = db.collection('registrations').doc(`payment-${orderCode}`);
                transaction.set(registrationRef, {
                    id,
                    paymentOrderCode: orderCode,
                    userId: String(tx.userId || ''),
                    userName: String(tx.userName || 'Thành viên'),
                    eventId: String(tx.eventId || ''),
                    eventTitle: String(tx.eventTitle || ''),
                    price: 0,
                    time: tx.time || now
                }, { merge: true });
            } else if (tx.type === 'team_registration' && !duplicateEntitlement) {
                const subId = nextId();
                const submissionRef = db.collection('submissions').doc(`payment-${orderCode}`);
                transaction.set(submissionRef, {
                    id: subId,
                    paymentOrderCode: orderCode,
                    title: String(tx.submissionTitle || 'Bài dự thi'),
                    teamId: String(tx.eventId || ''),
                    teamName,
                    userId: String(tx.userId || ''),
                    userName: String(tx.userName || 'Thành viên'),
                    status: 'pending',
                    fee: expectedAmount,
                    memberCount: memberRecords.length + 1,
                    certIssued: true,
                    certCount: memberRecords.length + 1,
                    votes: 0,
                    createdAt: now
                }, { merge: true });

                const leaderCertRef = db.collection('certificates').doc(`payment-${orderCode}-leader`);
                transaction.set(leaderCertRef, {
                    id: `YNDA-${orderCode}-L`,
                    paymentOrderCode: orderCode,
                    userId: String(tx.userId || ''),
                    userName: userNames[tx.userId] || tx.userName || 'Thành viên',
                    type: 'participation',
                    achievement: `Tham gia cuộc thi - ${teamName}`,
                    teamId: String(tx.eventId || ''),
                    teamName,
                    role: 'Trưởng nhóm',
                    issuedAt: now,
                    status: 'active'
                }, { merge: true });

                for (const member of memberRecords) {
                    const safeUid = String(member.userId || member.id).replace(/[^A-Za-z0-9_-]/g, '_');
                    const memberCertRef = db.collection('certificates').doc(`payment-${orderCode}-member-${safeUid}`);
                    transaction.set(memberCertRef, {
                        id: `YNDA-${orderCode}-${safeUid}`,
                        paymentOrderCode: orderCode,
                        userId: String(member.userId || ''),
                        userName: userNames[member.userId] || 'Thành viên',
                        type: 'participation',
                        achievement: `Tham gia cuộc thi - ${teamName}`,
                        teamId: String(tx.eventId || ''),
                        teamName,
                        role: member.role || 'Thành viên',
                        issuedAt: now,
                        status: 'active'
                    }, { merge: true });
                }
            } else if (!['registration', 'team_registration', 'sponsor'].includes(tx.type)) {
                throw error('Unsupported payment type', 400);
            }

            const budgetRef = db.collection('budget').doc(`payment-${orderCode}`);
            const label = tx.type === 'registration'
                ? `Thu phí đăng ký: ${tx.eventTitle || tx.eventId} - ${tx.userName || ''}`
                : tx.type === 'team_registration'
                    ? `Thu phí thi đội: ${tx.eventTitle || tx.eventId} - ${tx.userName || ''}`
                    : `Nhận tài trợ: Gói ủng hộ - ${tx.userName || ''}`;
            transaction.set(budgetRef, {
                id: `payment-${orderCode}`,
                paymentOrderCode: orderCode,
                type: 'in',
                label,
                amount: expectedAmount,
                date: now.slice(0, 10)
            }, { merge: true });

            const currentTotal = Number(prizePoolSnap.exists && prizePoolSnap.data().total) || 0;
            const addedAmount = Math.round(expectedAmount * 0.7);
            transaction.set(seqRef, { val: currentSeq }, { merge: true });
            transaction.set(prizePoolRef, { total: currentTotal + addedAmount }, { merge: true });
            transaction.create(markerRef, {
                orderCode,
                transactionId: txRef.id,
                type: tx.type,
                amount: expectedAmount,
                fulfilledAt: admin.firestore.FieldValue.serverTimestamp()
            });
            if (entitlementRef && !duplicateEntitlement) {
                transaction.create(entitlementRef, {
                    key: entitlementKey,
                    orderCode,
                    userId: String(tx.userId || ''),
                    targetId: String(tx.eventId || ''),
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
            transaction.update(txRef, {
                status: 'confirmed',
                confirmedAt: now,
                fulfillmentVersion: 2,
                duplicateEntitlement
            });
            return { alreadyConfirmed: false, duplicateEntitlement };
        });

        console.log(`[Payment] Order ${orderCode} fulfilled${result.alreadyConfirmed ? ' (idempotent)' : ''}.`);
        return { success: true, message: result.alreadyConfirmed ? 'Already confirmed' : undefined };
    } catch (err) {
        console.error(`[Payment] Fulfillment failed for order ${orderCode}:`, err.message || err);
        return { success: false, message: err.message || 'Fulfillment failed' };
    }
}

module.exports = { confirmTransaction, recoverTransactionFromIntent, asSafeAmount, MAX_AMOUNT };
