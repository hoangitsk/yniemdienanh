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

module.exports = async function listScheduleUsers(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
        const body = req.body || {};
        if (!body.idToken) return res.status(400).json({ error: 'Thiếu mã xác thực.' });
        const db = getDb();
        const decoded = await admin.auth().verifyIdToken(body.idToken);
        const operatorDoc = await db.collection('users').doc(decoded.uid).get();
        const operator = operatorDoc.exists ? operatorDoc.data() : {};
        const isProjectAdmin = String(decoded.email || '').toLowerCase() === 'yniemdienanh@gmail.com';
        if (!decoded.email_verified || (!isProjectAdmin && !['admin', 'organizer'].includes(operator.role))) {
            return res.status(403).json({ error: 'Chỉ Admin/BTC mới được xem danh sách tài khoản.' });
        }

        const [authPage, profilesSnap] = await Promise.all([
            admin.auth().listUsers(1000),
            db.collection('users').get()
        ]);
        const profiles = new Map(profilesSnap.docs.map(doc => [doc.id, doc.data()]));
        const users = authPage.users
            .filter(user => user.email && !user.disabled)
            .map(user => {
                const profile = profiles.get(user.uid) || {};
                return {
                    id: user.uid,
                    name: profile.name || user.displayName || String(user.email).split('@')[0],
                    email: user.email,
                    dept: profile.dept || '',
                    role: String(user.email || '').toLowerCase() === 'yniemdienanh@gmail.com' ? 'admin' : (profile.role || 'member'),
                    position: profile.position || profile.title || ''
                };
            });
        return res.status(200).json({ users });
    } catch (error) {
        console.error('List schedule users error:', error);
        return res.status(error.code === 'auth/id-token-expired' ? 401 : 500).json({ error: error.message || 'Không thể tải danh sách tài khoản.' });
    }
};
