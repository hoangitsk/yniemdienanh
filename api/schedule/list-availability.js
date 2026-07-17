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

module.exports = async function listAvailabilityForStaff(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
        const body = req.body || {};
        if (!body.idToken) return res.status(400).json({ error: 'Thiếu mã xác thực.' });
        const db = getDb();
        const decoded = await admin.auth().verifyIdToken(body.idToken);
        const profileDoc = await db.collection('users').doc(decoded.uid).get();
        const profile = profileDoc.exists ? profileDoc.data() : {};
        const allowed = isScheduleManager(decoded, profile);
        if (!decoded.email_verified) {
            return res.status(403).json({ error: 'Tài khoản chưa xác minh email.' });
        }
        const [pollsSnap, schedulesSnap] = await Promise.all([
            db.collection('availabilityPolls').get(),
            allowed ? db.collection('meetingSchedules').get() : db.collection('meetingSchedules').where('ownerId', '==', decoded.uid).get()
        ]);
        const schedules = schedulesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const signedInEmail = String(decoded.email || '').trim().toLowerCase();
        const respondedPollIds = new Set(schedules.filter(item => item.ownerId === decoded.uid && (item.completedAt || item.finalizedAt)).map(item => String(item.pollId || '')));
        const visibleSchedules = allowed ? schedules : schedules.filter(item => !(item.completedAt || item.finalizedAt));
        const now = Date.now();
        const polls = pollsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(poll => {
            if (allowed) return true;
            const assigned = poll.isPublic === true ||
                (Array.isArray(poll.participantIds) && poll.participantIds.includes(decoded.uid)) ||
                (signedInEmail && Array.isArray(poll.participantEmails) && poll.participantEmails.some(email => String(email).trim().toLowerCase() === signedInEmail));
            const active = poll.status === 'open' && (!pollEndAt(poll) || now < pollEndAt(poll));
            return assigned && active && !respondedPollIds.has(String(poll.id));
        });
        const safePolls = allowed ? polls : polls.map(poll => ({
            ...poll,
            // Không gửi danh sách Gmail của các ứng viên khác xuống trình duyệt.
            participantEmails: (Array.isArray(poll.participantEmails) && poll.participantEmails.some(email => String(email).trim().toLowerCase() === signedInEmail))
                ? [signedInEmail]
                : []
        }));
        return res.status(200).json({
            polls: safePolls,
            schedules: visibleSchedules
        });
    } catch (error) {
        console.error('List staff availability error:', error);
        return res.status(error.code === 'auth/id-token-expired' ? 401 : 500).json({ error: error.message || 'Không thể tải toàn bộ lịch.' });
    }
};
