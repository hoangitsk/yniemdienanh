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
        if (!decoded.email_verified || !isScheduleManager(decoded, operator)) {
            return res.status(403).json({ error: 'Chỉ Admin/BTC mới được xem danh sách tài khoản.' });
        }

        const [authPage, profilesSnap, applicationsSnap] = await Promise.all([
            admin.auth().listUsers(1000),
            db.collection('users').get(),
            db.collection('applications').get()
        ]);
        const profiles = new Map(profilesSnap.docs.map(doc => [doc.id, doc.data()]));
        const applicationsByEmail = new Map();
        applicationsSnap.docs.forEach(doc => {
            const application = doc.data() || {};
            const email = String(application.email || '').trim().toLowerCase();
            if (!email) return;
            const current = applicationsByEmail.get(email);
            const currentTime = String(current && (current.reviewedAt || current.createdAt || current.submittedAt) || '');
            const nextTime = String(application.reviewedAt || application.createdAt || application.submittedAt || '');
            if (!current || nextTime >= currentTime) applicationsByEmail.set(email, application);
        });
        const users = authPage.users
            .filter(user => user.email && !user.disabled)
            .map(user => {
                const profile = profiles.get(user.uid) || {};
                const application = applicationsByEmail.get(String(user.email).toLowerCase()) || {};
                return {
                    id: user.uid,
                    name: profile.name || user.displayName || String(user.email).split('@')[0],
                    email: user.email,
                    dept: profile.dept || application.dept || '',
                    role: String(user.email || '').toLowerCase() === 'yniemdienanh@gmail.com' ? 'admin' : (profile.role || 'member'),
                    position: profile.position || profile.title || application.position || '',
                    projectGroup: profile.projectGroup || '',
                    leadershipTitle: profile.leadershipTitle || ''
                };
            });
        return res.status(200).json({ users });
    } catch (error) {
        console.error('List schedule users error:', error);
        return res.status(error.code === 'auth/id-token-expired' ? 401 : 500).json({ error: error.message || 'Không thể tải danh sách tài khoản.' });
    }
};
