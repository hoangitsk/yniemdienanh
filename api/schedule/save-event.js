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

async function authorize(req, db) {
    const idToken = req.body && req.body.idToken;
    if (!idToken) throw Object.assign(new Error('Thiếu mã xác thực.'), { status:400 });
    const decoded = await admin.auth().verifyIdToken(idToken);
    const profileDoc = await db.collection('users').doc(decoded.uid).get();
    const profile = profileDoc.exists ? profileDoc.data() : {};
    const isProjectAdmin = String(decoded.email || '').toLowerCase() === 'yniemdienanh@gmail.com';
    if (!decoded.email_verified || !isScheduleManager(decoded, profile)) {
        throw Object.assign(new Error('Chỉ Admin/BTC mới được lưu lịch.'), { status:403 });
    }
    return decoded;
}

module.exports = async function saveScheduleEvent(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error:'Method not allowed' });
    try {
        const body = req.body || {};
        const db = getDb();
        const decoded = await authorize(req, db);
        const mode = body.mode === 'update' ? 'update' : 'create';
        const event = body.event && typeof body.event === 'object' ? { ...body.event } : {};
        delete event.id;
        delete event.syncState;
        event.updatedAt = new Date().toISOString();
        event.updatedBy = decoded.uid;
        let ref;
        if (mode === 'update') {
            if (!body.eventId) return res.status(400).json({ error:'Thiếu mã lịch cần cập nhật.' });
            ref = db.collection('scheduledEvents').doc(String(body.eventId));
            await ref.set(event, { merge:true });
        } else {
            const id = String(body.eventId || '').trim();
            ref = id ? db.collection('scheduledEvents').doc(id) : db.collection('scheduledEvents').doc();
            event.createdBy = event.createdBy || decoded.uid;
            await ref.set(event, { merge:false });
        }
        return res.status(200).json({ success:true, id:ref.id });
    } catch (error) {
        console.error('Save schedule event error:', error);
        return res.status(error.status || (error.code === 'auth/id-token-expired' ? 401 : 500)).json({ error:error.message || 'Không thể lưu lịch.' });
    }
};
