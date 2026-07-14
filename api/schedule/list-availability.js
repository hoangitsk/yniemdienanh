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

function isHrProfile(profile) {
    const dept = String(profile.dept || '').trim().toLowerCase();
    return dept === 'hr' || dept.includes('nhân sự') || dept.includes('nhan su');
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
        const projectAdmin = String(decoded.email || '').toLowerCase() === 'yniemdienanh@gmail.com';
        const allowed = projectAdmin || ['admin', 'organizer'].includes(profile.role) || isHrProfile(profile);
        if (!decoded.email_verified || !allowed) {
            return res.status(403).json({ error: 'Chỉ Admin/BTC/Ban Nhân sự mới được xem toàn bộ lịch.' });
        }
        const [pollsSnap, schedulesSnap] = await Promise.all([
            db.collection('availabilityPolls').get(),
            db.collection('meetingSchedules').get()
        ]);
        return res.status(200).json({
            polls: pollsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
            schedules: schedulesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        });
    } catch (error) {
        console.error('List staff availability error:', error);
        return res.status(error.code === 'auth/id-token-expired' ? 401 : 500).json({ error: error.message || 'Không thể tải toàn bộ lịch.' });
    }
};
