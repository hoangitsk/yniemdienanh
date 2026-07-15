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

function isOrganizer(decoded, profile) {
    return String(decoded.email || '').toLowerCase() === 'yniemdienanh@gmail.com' ||
        ['admin', 'organizer'].includes(String(profile.role || '').toLowerCase());
}

function allowedSlotIds(poll) {
    const result = new Set();
    const start = new Date(String(poll.startDate || '') + 'T00:00:00+07:00');
    if (Number.isNaN(start.getTime())) return result;
    const dayCount = Math.max(1, Math.min(14, Number(poll.dayCount || 7)));
    for (let day = 0; day < dayCount; day += 1) {
        const date = new Date(start);
        date.setUTCDate(date.getUTCDate() + day);
        const dateId = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(date);
        for (let shift = 0; shift < 6; shift += 1) result.add(dateId + '_' + shift);
    }
    return result;
}

module.exports = async function saveAvailability(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
        const body = req.body || {};
        if (!body.idToken || !body.pollId) return res.status(400).json({ error: 'Thiếu thông tin xác thực hoặc đợt vote.' });

        const db = getDb();
        const decoded = await admin.auth().verifyIdToken(body.idToken);
        const [profileDoc, pollDoc] = await Promise.all([
            db.collection('users').doc(decoded.uid).get(),
            db.collection('availabilityPolls').doc(String(body.pollId)).get()
        ]);
        if (!pollDoc.exists) return res.status(404).json({ error: 'Đợt vote không còn tồn tại.' });

        const profile = profileDoc.exists ? profileDoc.data() : {};
        const poll = pollDoc.data();
        const organizer = isOrganizer(decoded, profile);
        const assigned = poll.isPublic === true || (Array.isArray(poll.participantIds) && poll.participantIds.includes(decoded.uid));
        if (!decoded.email_verified && !organizer) return res.status(403).json({ error: 'Tài khoản chưa xác thực email.' });
        if (!organizer && !assigned) return res.status(403).json({ error: 'Tài khoản không nằm trong danh sách của đợt vote.' });

        const docId = String(body.pollId) + '_' + decoded.uid;
        const ref = db.collection('meetingSchedules').doc(docId);
        if (body.action === 'delete') {
            if (!organizer && poll.status !== 'open') return res.status(403).json({ error: 'Đợt vote đã khóa nên không thể xóa.' });
            await ref.delete();
            return res.status(200).json({ success: true, deleted: true, id: docId });
        }

        if (poll.status !== 'open') return res.status(403).json({ error: 'Đợt vote đã khóa nên không thể lưu.' });
        const validSlots = allowedSlotIds(poll);
        const slots = Array.from(new Set(Array.isArray(body.slots) ? body.slots.map(String) : []))
            .filter((slotId) => validSlots.has(slotId));
        const slotSet = new Set(slots);
        const preferredSlots = Array.from(new Set(Array.isArray(body.preferredSlots) ? body.preferredSlots.map(String) : []))
            .filter((slotId) => slotSet.has(slotId));
        const allowedRoles = new Set(['member', 'btc', 'candidate', 'mentor']);
        const role = allowedRoles.has(body.role) ? body.role : 'member';
        const name = String(body.name || decoded.name || profile.name || String(decoded.email || '').split('@')[0] || 'Thành viên').trim().slice(0, 150);
        const schedule = {
            id: docId,
            ownerId: decoded.uid,
            pollId: String(body.pollId),
            pollTitle: String(poll.title || '').slice(0, 150),
            name,
            role,
            slots,
            preferredSlots,
            rangeStart: poll.startDate || null,
            dayCount: Math.max(1, Math.min(14, Number(poll.dayCount || 7))),
            submittedAt: new Date().toISOString()
        };
        await ref.set(schedule);
        return res.status(200).json({ success: true, schedule });
    } catch (error) {
        console.error('Save availability error:', error);
        const status = error.code === 'auth/id-token-expired' ? 401 : 500;
        return res.status(status).json({ error: error.message || 'Không thể lưu lịch rảnh.' });
    }
};
