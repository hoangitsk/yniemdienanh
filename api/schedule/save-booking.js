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

module.exports = async function saveScheduleBooking(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error:'Method not allowed' });
    try {
        const body = req.body || {};
        if (!body.idToken || !body.bookingId || !body.booking) return res.status(400).json({ error:'Thiếu thông tin lượt đặt lịch.' });
        const db = getDb();
        const decoded = await admin.auth().verifyIdToken(body.idToken);
        const profileDoc = await db.collection('users').doc(decoded.uid).get();
        const profile = profileDoc.exists ? profileDoc.data() : {};
        const isProjectAdmin = String(decoded.email || '').toLowerCase() === 'yniemdienanh@gmail.com';
        if (!decoded.email_verified || !isScheduleManager(decoded, profile)) {
            return res.status(403).json({ error:'Chỉ Admin/BTC mới được xác nhận lịch.' });
        }
        const booking = { ...body.booking, id:String(body.bookingId), updatedAt:new Date().toISOString(), updatedBy:decoded.uid };
        await db.collection('scheduledBookings').doc(String(body.bookingId)).set(booking, { merge:true });
        return res.status(200).json({ success:true, id:String(body.bookingId) });
    } catch (error) {
        console.error('Save schedule booking error:', error);
        return res.status(error.code === 'auth/id-token-expired' ? 401 : 500).json({ error:error.message || 'Không thể lưu xác nhận lịch.' });
    }
};
