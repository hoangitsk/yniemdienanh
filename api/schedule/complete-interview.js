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

function pollEndAt(poll) {
    if (!poll || !/^\d{4}-\d{2}-\d{2}$/.test(String(poll.startDate || ''))) return 0;
    const end = new Date(String(poll.startDate) + 'T00:00:00+07:00');
    end.setUTCDate(end.getUTCDate() + Math.max(1, Math.min(14, Number(poll.dayCount || 7))));
    return end.getTime();
}

module.exports = async function completeInterview(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
        const body = req.body || {};
        const eventId = String(body.eventId || '').trim();
        if (!body.idToken || !eventId) return res.status(400).json({ error: 'Thiếu phiên đăng nhập hoặc mã lịch phỏng vấn.' });
        const db = getDb();
        const decoded = await admin.auth().verifyIdToken(body.idToken);
        const operatorDoc = await db.collection('users').doc(decoded.uid).get();
        const operator = operatorDoc.exists ? operatorDoc.data() : {};
        if (!decoded.email_verified || !isScheduleManager(decoded, operator)) {
            return res.status(403).json({ error: 'Chỉ Admin/BTC/HR/PR mới được hoàn tất phỏng vấn.' });
        }

        const eventRef = db.collection('scheduledEvents').doc(eventId);
        const eventDoc = await eventRef.get();
        if (!eventDoc.exists) return res.status(404).json({ error: 'Lịch phỏng vấn không còn tồn tại.' });
        const event = eventDoc.data();
        if (event.type !== 'interview') return res.status(400).json({ error: 'Lịch này không phải lịch phỏng vấn.' });
        if (event.completedAt) return res.status(200).json({ success: true, alreadyCompleted: true, completedAt: event.completedAt });
        const eventStart = event.startAt ? new Date(event.startAt).getTime() : NaN;
        if (!event.startAt || Number.isNaN(eventStart) || eventStart > Date.now()) {
            return res.status(400).json({ error: 'Chỉ có thể hoàn tất sau khi buổi phỏng vấn đã bắt đầu.' });
        }
        if (!event.assignedHrId) return res.status(400).json({ error: 'Lịch chưa có người phỏng vấn phụ trách.' });

        const [hrDoc, bookingsSnap, pollsSnap] = await Promise.all([
            db.collection('users').doc(String(event.assignedHrId)).get(),
            db.collection('scheduledBookings').where('eventId', '==', eventId).get(),
            db.collection('availabilityPolls').get()
        ]);
        if (!hrDoc.exists) return res.status(400).json({ error: 'Không tìm thấy tài khoản người phỏng vấn.' });
        const hr = { id: hrDoc.id, ...hrDoc.data() };
        const bookings = bookingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(item => item.status === 'confirmed' && item.candidateId);
        if (!bookings.length) return res.status(400).json({ error: 'Chưa có ứng viên được xác nhận trong lịch này.' });

        const now = new Date();
        const meetingPolls = pollsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(poll => poll.type === 'meeting' && poll.status === 'open' && (!pollEndAt(poll) || now.getTime() < pollEndAt(poll)))
            .sort((a, b) => {
                const aHop = /^HOP/i.test(String(a.code || '')) ? 1 : 0;
                const bHop = /^HOP/i.test(String(b.code || '')) ? 1 : 0;
                return bHop - aHop || String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
            });
        const transitions = bookings.map(booking => {
            const poll = meetingPolls.find(item => item.isPublic === true || (Array.isArray(item.participantIds) && item.participantIds.includes(booking.candidateId)));
            return { candidateId: booking.candidateId, nextScheduleCode: poll && poll.code || '', nextPollId: poll && poll.id || '' };
        });

        const batch = db.batch();
        const pointId = 'interview_' + eventId + '_' + hr.id;
        batch.set(db.collection('staffPoints').doc(pointId), {
            id: pointId,
            userId: hr.id,
            userName: hr.name || hr.email || event.assignedHrName || '',
            dept: hr.dept || 'Ban Nhân Sự',
            points: 10,
            sourceType: 'interview',
            sourceId: eventId,
            reason: 'Hoàn thành phỏng vấn: ' + String(event.title || ''),
            awardedBy: decoded.uid,
            createdAt: now.toISOString()
        }, { merge: false });
        batch.set(eventRef, {
            completedAt: now.toISOString(),
            completedBy: decoded.uid,
            nextScheduleCodes: transitions.filter(item => item.nextScheduleCode).reduce((result, item) => {
                result[item.candidateId] = item.nextScheduleCode;
                return result;
            }, {})
        }, { merge: true });
        transitions.forEach(item => {
            const update = {
                interviewStatus: 'completed',
                recruitmentStage: item.nextScheduleCode ? 'meeting_vote' : 'interview_completed',
                interviewCompletedAt: now.toISOString(),
                updatedAt: now.toISOString(),
                updatedBy: decoded.uid
            };
            if (item.nextScheduleCode) {
                update.nextScheduleCode = item.nextScheduleCode;
                update.activeScheduleCode = item.nextScheduleCode;
            }
            batch.set(db.collection('users').doc(item.candidateId), update, { merge: true });
        });
        await batch.commit();
        return res.status(200).json({ success: true, completedAt: now.toISOString(), transitions });
    } catch (error) {
        console.error('Complete interview error:', error);
        return res.status(error.code === 'auth/id-token-expired' ? 401 : 500).json({ error: error.message || 'Không thể hoàn tất phỏng vấn.' });
    }
};
