const admin = require('firebase-admin');
const { createGoogleMeet, addGoogleCalendarAttendees } = require('../../lib/interviewFinalizer');
const { isScheduleManager } = require('../../lib/schedulePermissions');

function getDb() {
    if (!admin.apps.length) {
        let raw = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT chưa được cấu hình.');
        raw = raw.trim().replace(/^"|"$/g, '');
        let account = JSON.parse(raw);
        if (typeof account === 'string') account = JSON.parse(account);
        if (account.private_key) account.private_key = account.private_key.replace(/\\n/g, '\n');
        admin.initializeApp({ credential:admin.credential.cert(account) });
    }
    return admin.firestore();
}

module.exports = async function createScheduleMeet(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error:'Method not allowed' });
    try {
        const body = req.body || {};
        if (!body.idToken || !body.eventId) return res.status(400).json({ error:'Thiếu lịch hoặc mã xác thực.' });
        const db = getDb();
        const decoded = await admin.auth().verifyIdToken(body.idToken);
        const profileDoc = await db.collection('users').doc(decoded.uid).get();
        const profile = profileDoc.exists ? profileDoc.data() : {};
        const isProjectAdmin = String(decoded.email || '').toLowerCase() === 'yniemdienanh@gmail.com';
        if (!decoded.email_verified || !isScheduleManager(decoded, profile)) {
            return res.status(403).json({ error:'Chỉ Admin/BTC mới có thể tạo Google Meet.' });
        }
        const eventRef = db.collection('scheduledEvents').doc(String(body.eventId));
        const eventDoc = await eventRef.get();
        if (!eventDoc.exists) return res.status(404).json({ error:'Không tìm thấy lịch.' });
        const event = { id:eventDoc.id, ...eventDoc.data() };
        const candidateEmail = String(body.candidateEmail || '').trim().toLowerCase();
        const hrEmail = String(event.assignedHrEmail || '').trim().toLowerCase();
        const calendar = event.googleCalendarEventId
            ? await addGoogleCalendarAttendees(event, candidateEmail, hrEmail)
            : await createGoogleMeet(event.id, event, candidateEmail, hrEmail);
        await eventRef.set({
            location:calendar.meetLink,
            googleCalendarEventId:calendar.calendarEventId,
            googleCalendarHtmlLink:calendar.calendarHtmlLink,
            googleCalendarCreatedAt:new Date().toISOString(),
            googleCalendarOwner:'project-calendar'
        }, { merge:true });
        return res.status(200).json({ success:true, ...calendar });
    } catch (error) {
        console.error('Create schedule Meet error:', error);
        return res.status(error.code === 'auth/id-token-expired' ? 401 : 500).json({ error:error.message || 'Không thể tạo Google Meet.' });
    }
};
