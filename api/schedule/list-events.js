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

module.exports = async function listScheduleEvents(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
        const body = req.body || {};
        if (!body.idToken) return res.status(400).json({ error: 'Thiếu mã xác thực.' });
        const db = getDb();
        const decoded = await admin.auth().verifyIdToken(body.idToken);
        if (!decoded.email_verified) return res.status(403).json({ error: 'Tài khoản chưa xác minh email.' });
        const profileDoc = await db.collection('users').doc(decoded.uid).get();
        const profile = profileDoc.exists ? profileDoc.data() : {};
        const manager = isScheduleManager(decoded, profile);
        const [eventsSnap, bookingsSnap, pollsSnap] = await Promise.all([
            db.collection('scheduledEvents').get(),
            manager ? db.collection('scheduledBookings').get() : db.collection('scheduledBookings').where('candidateId', '==', decoded.uid).get(),
            manager ? Promise.resolve(null) : db.collection('availabilityPolls').get()
        ]);
        const allEvents = eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(event => event.status !== 'cancelled');
        const bookings = bookingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (manager) return res.status(200).json({ events: allEvents, bookings });

        const now = Date.now();
        const signedInEmail = String(decoded.email || '').trim().toLowerCase();
        const visiblePollIds = new Set((pollsSnap ? pollsSnap.docs : []).map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(poll => poll.status === 'open' && (!pollEndAt(poll) || now < pollEndAt(poll)) && (poll.isPublic === true ||
                (Array.isArray(poll.participantIds) && poll.participantIds.includes(decoded.uid)) ||
                (signedInEmail && Array.isArray(poll.participantEmails) && poll.participantEmails.some(email => String(email).trim().toLowerCase() === signedInEmail))))
            .map(poll => String(poll.id)));
        const ownBookingEventIds = new Set(bookings.filter(item => item.candidateId === decoded.uid).map(item => String(item.eventId)));
        const events = allEvents.filter(event =>
            ownBookingEventIds.has(String(event.id)) ||
            (event.isPublic === true && (!event.availabilityPollId || visiblePollIds.has(String(event.availabilityPollId)))) ||
            (event.availabilityPollId && visiblePollIds.has(String(event.availabilityPollId)) && !event.generatedFromAvailability)
        );
        return res.status(200).json({
            events,
            bookings: bookings.filter(item => item.candidateId === decoded.uid)
        });
    } catch (error) {
        console.error('List schedule events error:', error);
        return res.status(error.code === 'auth/id-token-expired' ? 401 : 500).json({ error: error.message || 'Không thể tải lịch.' });
    }
};
