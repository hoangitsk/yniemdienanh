const admin = require('firebase-admin');

/**
 * Confirms a pending transaction and performs the associated fulfillment (registrations, submissions, certs).
 * This function is fully idempotent and verifies transaction details.
 * 
 * @param {admin.firestore.Firestore} db Firebase Firestore Instance
 * @param {number} orderNum The PayOS order code
 * @param {number} amountPaid The verified amount paid from PayOS
 * @returns {Promise<{success: boolean, message?: string}>}
 */
async function confirmTransaction(db, orderNum, amountPaid) {
    if (!db) {
        return { success: false, message: 'Firebase Admin not initialized' };
    }

    const txQuery = await db.collection('transactions').where('orderCode', '==', orderNum).limit(1).get();
    if (txQuery.empty) {
        console.warn(`[Payment] Transaction not found for orderCode: ${orderNum}`);
        return { success: false, message: 'Transaction not found in database' };
    }

    const txDoc = txQuery.docs[0];
    const tx = txDoc.data();

    // 1. Idempotency check
    if (tx.status === 'confirmed') {
        console.log(`[Payment] Transaction ${orderNum} is already confirmed.`);
        return { success: true, message: 'Already confirmed' };
    }

    // 2. Verify webhook amount matches stored transaction amount
    if (Number(tx.amount) !== Number(amountPaid)) {
        console.error(`[Payment] Amount mismatch for order ${orderNum}: Expected ${tx.amount}, got ${amountPaid}`);
        return { success: false, message: 'Transaction amount mismatch' };
    }

    // 3. Load associated metadata for fulfillment if team_registration
    let members = [];
    let userNames = {};
    if (tx.type === 'team_registration') {
        try {
            // Get team members
            const membersSnap = await db.collection('team_members')
                .where('teamId', '==', tx.eventId)
                .get();
            membersSnap.forEach(doc => members.push(doc.data()));

            // Resolve member names
            const memberUserIds = [tx.userId, ...members.map(m => m.userId)];
            const userDocs = await Promise.all(memberUserIds.map(uid => db.collection('users').doc(uid).get()));
            userDocs.forEach(ud => {
                if (ud.exists) {
                    userNames[ud.id] = ud.data().name || ud.data().displayName || 'Thành viên';
                } else {
                    userNames[ud.id] = 'Thành viên';
                }
            });
        } catch (err) {
            console.error('[Payment] Failed to query team members for fulfillment:', err.message);
        }
    }

    // 4. Perform atomic database transaction to confirm payment and create registrations/records
    await db.runTransaction(async (t) => {
        const seqRef = db.collection('config').doc('sequence');
        const ppRef = db.collection('config').doc('prizePool');

        // All reads first
        const seqDoc = await t.get(seqRef);
        const ppDoc = await t.get(ppRef);

        let currentSeq = seqDoc.exists ? (seqDoc.data().val || 100) : 100;

        // Perform writes
        if (tx.type === 'registration') {
            currentSeq += 1;
            const regRef = db.collection('registrations').doc(String(currentSeq));
            t.set(regRef, {
                id: currentSeq,
                userId: tx.userId,
                userName: tx.userName,
                eventId: tx.eventId,
                eventTitle: tx.eventTitle,
                time: tx.time || new Date().toISOString()
            });
        } else if (tx.type === 'team_registration') {
            currentSeq += 1;
            const subId = currentSeq;
            const teamName = String(tx.eventTitle || '').replace('Đăng ký đội ', '');

            // Write submission document
            const subRef = db.collection('submissions').doc(String(subId));
            t.set(subRef, {
                id: subId,
                title: tx.submissionTitle || 'Bài dự thi',
                teamId: tx.eventId,
                teamName: teamName,
                userId: tx.userId,
                userName: tx.userName,
                status: 'pending',
                fee: tx.amount,
                memberCount: members.length + 1,
                certIssued: true,
                certCount: members.length + 1,
                createdAt: new Date().toISOString()
            });

            // Write certificate for leader
            currentSeq += 1;
            const leaderCertRef = db.collection('certificates').doc(String(currentSeq));
            t.set(leaderCertRef, {
                id: String(currentSeq),
                userId: tx.userId,
                userName: userNames[tx.userId] || tx.userName,
                type: 'participation',
                achievement: `Tham gia cuộc thi - ${teamName}`,
                teamId: tx.eventId,
                teamName: teamName,
                role: 'Trưởng nhóm',
                issuedAt: new Date().toISOString()
            });

            // Write certificates for members
            for (const m of members) {
                currentSeq += 1;
                const memberCertRef = db.collection('certificates').doc(String(currentSeq));
                t.set(memberCertRef, {
                    id: String(currentSeq),
                    userId: m.userId,
                    userName: userNames[m.userId] || 'Thành viên',
                    type: 'participation',
                    achievement: `Tham gia cuộc thi - ${teamName}`,
                    teamId: tx.eventId,
                    teamName: teamName,
                    role: m.role || 'Thành viên',
                    issuedAt: new Date().toISOString()
                });
            }
        }

        // Add ledger entry to budget log
        currentSeq += 1;
        const budgetId = currentSeq;
        let label = '';
        if (tx.type === 'registration') {
            label = `Thu phí đăng ký: ${tx.eventTitle || tx.eventId} - ${tx.userName}`;
        } else if (tx.type === 'team_registration') {
            label = `Thu phí thi đội: ${tx.eventTitle} - ${tx.userName}`;
        } else if (tx.type === 'vote') {
            label = `Ủng hộ tác phẩm: ${tx.submissionTitle || tx.submissionId} - ${tx.userName}`;
        } else {
            label = `Nhận tài trợ: Gói ủng hộ - ${tx.userName}`;
        }

        const budgetRef = db.collection('budget').doc(String(budgetId));
        t.set(budgetRef, {
            id: budgetId,
            type: 'in',
            label: label,
            amount: tx.amount || 5000,
            date: new Date().toISOString().slice(0, 10)
        });

        // Save updated sequence number
        t.set(seqRef, { val: currentSeq });

        // Update prize pool config (70% allocated to prize pool, 30% for operations)
        const currentTotal = ppDoc.exists ? (ppDoc.data().total || 0) : 0;
        const addedAmount = Math.round((tx.amount || 5000) * 0.7);
        t.set(ppRef, { total: currentTotal + addedAmount }, { merge: true });

        // Confirm the transaction itself
        t.update(txDoc.ref, { status: 'confirmed' });
    });

    console.log(`[Payment] Order ${orderNum} fulfilled successfully.`);
    return { success: true };
}

module.exports = {
    confirmTransaction
};
