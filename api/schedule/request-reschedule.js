const admin = require('firebase-admin');

function getDb() {
    if (!admin.apps.length) {
        let raw = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT chưa được cấu hình.');
        raw = raw.trim().replace(/^"|"$/g, '');
        let account = JSON.parse(raw);
        if (typeof account === 'string') account = JSON.parse(account);
        if (account.private_key) account.private_key = account.private_key.replace(/\\n/g, '\n');
        admin.initializeApp({ credential: admin.credential.cert(account) });
    }
    return admin.firestore();
}

module.exports = async function requestReschedule(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
        const body = req.body || {};
        if (!body.idToken || !body.bookingId || !body.reason) return res.status(400).json({ error: 'Hãy nêu lý do yêu cầu đổi lịch.' });
        const db = getDb();
        const decoded = await admin.auth().verifyIdToken(body.idToken);
        if (!decoded.email_verified) return res.status(403).json({ error: 'Tài khoản chưa xác minh email.' });
        const bookingRef = db.collection('scheduledBookings').doc(String(body.bookingId));
        const requestRef = db.collection('rescheduleRequests').doc();
        const auditRef = db.collection('auditLogs').doc();
        const now = new Date();

        await db.runTransaction(async tx => {
            const bookingDoc = await tx.get(bookingRef);
            if (!bookingDoc.exists) throw new Error('Không tìm thấy lịch phỏng vấn.');
            const booking = bookingDoc.data();
            if (String(booking.candidateId) !== decoded.uid) throw new Error('Bạn không có quyền đổi lịch này.');
            if (booking.status !== 'confirmed') throw new Error('Lịch này không ở trạng thái có thể yêu cầu đổi.');
            const eventDoc = await tx.get(db.collection('scheduledEvents').doc(String(booking.eventId)));
            if (!eventDoc.exists) throw new Error('Lịch phỏng vấn không còn tồn tại.');
            const event = eventDoc.data();
            const hoursUntilInterview = (new Date(event.startAt).getTime() - now.getTime()) / 3600000;
            if (hoursUntilInterview < 12 && body.isEmergency !== true) throw new Error('Chỉ có thể đổi lịch trước giờ phỏng vấn ít nhất 12 giờ.');
            const oldRequests = await tx.get(db.collection('rescheduleRequests').where('bookingId', '==', bookingRef.id));
            if (oldRequests.docs.some(doc => ['pending', 'approved'].includes(doc.data().status))) throw new Error('Bạn đã có một yêu cầu đổi lịch đang được xử lý.');
            if (oldRequests.size >= 1 && body.isEmergency !== true) throw new Error('Mỗi ứng viên chỉ được đổi lịch một lần.');
            const requestedSlots = Array.from(new Set(Array.isArray(body.alternativeSlotIds) ? body.alternativeSlotIds.map(String) : [])).slice(0, 7);
            if (!requestedSlots.length) throw new Error('Hãy chọn ít nhất một khung giờ thay thế.');
            const pollId = String(event.availabilityPollId || '');
            const scheduleDoc = pollId ? await tx.get(db.collection('meetingSchedules').doc(pollId + '_' + decoded.uid)) : null;
            const votedSlots = scheduleDoc && scheduleDoc.exists ? new Set(scheduleDoc.data().slots || []) : new Set();
            if (requestedSlots.some(slot => !votedSlots.has(slot))) throw new Error('Khung giờ thay thế phải nằm trong các khung giờ bạn đã vote.');
            const timestamp = now.toISOString();
            tx.set(requestRef, { id: requestRef.id, bookingId: bookingRef.id, assignmentId: bookingRef.id, candidateId: decoded.uid,
                eventId: booking.eventId, reason: String(body.reason).slice(0, 500), alternativeSlotIds: requestedSlots,
                note: String(body.note || '').slice(0, 1500), isEmergency: body.isEmergency === true, status: 'pending', createdAt: timestamp, updatedAt: timestamp });
            tx.set(bookingRef, { rescheduleRequestedAt: timestamp, rescheduleRequestId: requestRef.id, updatedAt: timestamp }, { merge: true });
            tx.set(db.collection('users').doc(decoded.uid), { interviewStatus: 'RESCHEDULE_REQUESTED', updatedAt: timestamp }, { merge: true });
            tx.set(auditRef, { actorId: decoded.uid, actorRole: 'candidate', action: 'RESCHEDULE_REQUESTED', entityType: 'scheduledBooking', entityId: bookingRef.id, newValue: { alternativeSlotIds: requestedSlots }, reason: String(body.reason).slice(0, 500), createdAt: timestamp });
        });
        return res.status(200).json({ success: true, requestId: requestRef.id });
    } catch (error) {
        console.error('Request reschedule error:', error);
        return res.status(error.code === 'auth/id-token-expired' ? 401 : 409).json({ error: error.message || 'Không thể gửi yêu cầu đổi lịch.' });
    }
};
