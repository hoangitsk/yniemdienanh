const admin = require('firebase-admin');
const { isScheduleManager } = require('../../lib/schedulePermissions');

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

function overlaps(startA, endA, startB, endB) {
    return startA < endB && endA > startB;
}

function eventInterval(event) {
    const start = new Date(event.startAt).getTime();
    const minutes = Math.max(1, Math.min(180, Number(event.duration || 30)));
    return { start, end: start + minutes * 60000 };
}

function candidateVotedSlot(schedule, requestedSlotId) {
    const slots = Array.isArray(schedule && schedule.slots) ? schedule.slots.map(String) : [];
    // Luôn ưu tiên mã ca trùng khớp tuyệt đối. Một số phiếu đã tạo trong giai
    // đoạn chuyển đổi có slot 30 phút nhưng chưa lưu slotSchema; trước đây chúng
    // bị hiểu nhầm là dữ liệu ca cũ và server từ chối một khung giờ đang hiện
    // đúng trên giao diện.
    if (slots.includes(requestedSlotId)) return true;
    if (schedule && schedule.slotSchema === '30m-v1') return false;
    const parts = String(requestedSlotId).split('_');
    const index = Number(parts[1]);
    if (!parts[0] || !Number.isInteger(index) || index < 0) return false;
    return slots.some(slot => {
        const oldParts = String(slot).split('_');
        const oldIndex = Number(oldParts[1]);
        return oldParts[0] === parts[0] && Number.isInteger(oldIndex) && oldIndex >= 0 && oldIndex < 6 && index >= oldIndex * 3 && index < oldIndex * 3 + 3;
    });
}

module.exports = async function confirmInterview(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
        const body = req.body || {};
        if (!body.idToken || !body.candidateId || !body.hrId || !body.slotId || !body.event || !body.pollId) {
            return res.status(400).json({ error: 'Thiếu dữ liệu để xác nhận lịch.' });
        }
        const db = getDb();
        const decoded = await admin.auth().verifyIdToken(body.idToken);
        const operatorDoc = await db.collection('users').doc(decoded.uid).get();
        const operator = operatorDoc.exists ? operatorDoc.data() : {};
        if (!decoded.email_verified || !isScheduleManager(decoded, operator)) {
            return res.status(403).json({ error: 'Chỉ người có quyền điều phối mới được xác nhận lịch.' });
        }

        const candidateId = String(body.candidateId);
        const hrId = String(body.hrId);
        const slotId = String(body.slotId);
        const pollId = String(body.pollId);
        const startAt = new Date(body.event.startAt).toISOString();
        const duration = Math.max(1, Math.min(180, Number(body.event.duration || 30)));
        const interval = eventInterval({ startAt, duration });
        if (!Number.isFinite(interval.start)) return res.status(400).json({ error: 'Thời điểm phỏng vấn không hợp lệ.' });

        const eventRef = db.collection('scheduledEvents').doc();
        const bookingRef = db.collection('scheduledBookings').doc(eventRef.id + '_' + candidateId);
        const auditRef = db.collection('auditLogs').doc();
        const now = new Date().toISOString();
        let confirmedEvent;

        await db.runTransaction(async tx => {
            const candidateScheduleRef = db.collection('meetingSchedules').doc(pollId + '_' + candidateId);
            const [candidateDoc, hrDoc, candidateScheduleDoc, eventsSnap, bookingsSnap] = await Promise.all([
                tx.get(db.collection('users').doc(candidateId)),
                tx.get(db.collection('users').doc(hrId)),
                tx.get(candidateScheduleRef),
                tx.get(db.collection('scheduledEvents')),
                tx.get(db.collection('scheduledBookings'))
            ]);
            if (!candidateDoc.exists || !hrDoc.exists) throw new Error('Không tìm thấy ứng viên hoặc người phỏng vấn.');
            const candidateSchedule = candidateScheduleDoc.exists ? candidateScheduleDoc.data() : {};
            if (candidateSchedule.role !== 'candidate' || !candidateVotedSlot(candidateSchedule, slotId)) {
                throw new Error('Khung giờ này không nằm trong phiếu vote hợp lệ của ứng viên.');
            }

            const activeEvents = eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(event => event.status !== 'cancelled');
            const confirmedBookings = bookingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(booking => ['confirmed', 'proposed'].includes(booking.status));
            const bookedEventIds = new Set(confirmedBookings.map(booking => String(booking.eventId)));
            if (activeEvents.some(event => String(event.candidateId || '') === candidateId && ['confirmed', 'proposed', 'open'].includes(event.status))) {
                throw new Error('Ứng viên đã có lịch phỏng vấn đang hoạt động.');
            }
            for (const event of activeEvents) {
                if (!bookedEventIds.has(String(event.id)) && event.status !== 'confirmed') continue;
                const existing = eventInterval(event);
                if (!Number.isFinite(existing.start) || !overlaps(interval.start, interval.end, existing.start, existing.end)) continue;
                const sameCandidate = confirmedBookings.some(booking => String(booking.eventId) === String(event.id) && String(booking.candidateId) === candidateId);
                if (sameCandidate || String(event.candidateId || '') === candidateId) throw new Error('Ứng viên đã có một lịch phỏng vấn trùng giờ.');
                if (String(event.assignedHrId || '') === hrId) throw new Error('Người phỏng vấn đã có lịch khác trùng giờ.');
                if (body.event.location && event.location && String(event.location).trim() === String(body.event.location).trim()) {
                    throw new Error('Link Meet/phòng phỏng vấn đang được dùng ở một ca trùng giờ.');
                }
            }
            if (confirmedBookings.some(booking => String(booking.candidateId) === candidateId && String(booking.eventId) !== eventRef.id)) {
                throw new Error('Ứng viên đã có lịch phỏng vấn đang hoạt động.');
            }

            const candidate = candidateDoc.data();
            const hr = hrDoc.data();
            confirmedEvent = {
                ...body.event,
                id: eventRef.id,
                type: 'interview', startAt, duration, capacity: 1, status: 'confirmed',
                candidateId, candidateName: candidate.name || body.event.candidateName || '', candidateEmail: candidate.email || body.event.candidateEmail || '',
                candidatePosition: body.event.candidatePosition || candidate.position || candidate.title || '',
                candidateDepartment: body.event.candidateDepartment || candidate.dept || candidate.department || '',
                assignedHrId: hrId, assignedHrName: hr.name || body.event.assignedHrName || '', assignedHrEmail: hr.email || body.event.assignedHrEmail || '',
                slotId, availabilityPollId: pollId, confirmedAt: now, confirmedBy: decoded.uid, createdAt: now, createdBy: decoded.uid, updatedAt: now, updatedBy: decoded.uid
            };
            tx.set(eventRef, confirmedEvent);
            tx.set(bookingRef, {
                id: bookingRef.id, eventId: eventRef.id, candidateId, candidateName: confirmedEvent.candidateName,
                candidateEmail: confirmedEvent.candidateEmail, status: 'confirmed', source: 'hr_confirmation',
                createdAt: now, confirmedAt: now, confirmedBy: decoded.uid, updatedAt: now, updatedBy: decoded.uid
            });
            tx.set(db.collection('users').doc(candidateId), { interviewStatus: 'SCHEDULE_CONFIRMED', updatedAt: now }, { merge: true });
            tx.set(auditRef, { actorId: decoded.uid, actorRole: operator.role || 'schedule_manager', action: 'INTERVIEW_CONFIRMED', entityType: 'scheduledEvent', entityId: eventRef.id, newValue: { candidateId, hrId, slotId, startAt }, reason: 'HR xác nhận lịch từ phiếu vote.', createdAt: now });
        });
        return res.status(200).json({ success: true, event: confirmedEvent, booking: { id: bookingRef.id, eventId: eventRef.id, candidateId, status: 'confirmed' } });
    } catch (error) {
        console.error('Confirm interview error:', error);
        return res.status(error.code === 'auth/id-token-expired' ? 401 : 409).json({ error: error.message || 'Không thể xác nhận lịch.' });
    }
};
