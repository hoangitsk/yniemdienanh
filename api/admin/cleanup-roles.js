const admin = require('firebase-admin');
const { normalize } = require('../../lib/schedulePermissions');

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

module.exports = async function cleanupRoles(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
        const body = req.body || {};
        if (!body.idToken) return res.status(401).json({ error: 'Vui lòng đăng nhập lại.' });
        const db = getDb();
        const decoded = await admin.auth().verifyIdToken(body.idToken);
        if (String(decoded.email || '').toLowerCase() !== 'yniemdienanh@gmail.com') {
            const operatorDoc = await db.collection('users').doc(decoded.uid).get();
            const operator = operatorDoc.exists ? operatorDoc.data() : {};
            if (normalize(operator.role) !== 'admin') {
                return res.status(403).json({ error: 'Chỉ Admin dự án mới có thể chạy cleanup.' });
            }
        }

        const snapshot = await db.collection('users').get();
        let corrected = 0;
        let skipped = 0;
        const details = [];

        for (const doc of snapshot.docs) {
            const u = doc.data();
            if (u.role !== 'organizer') continue;

            const position = normalize(u.position || '');
            const title = normalize(u.title || '');
            const leadershipTitle = normalize(u.leadershipTitle || '');
            const dept = normalize(u.dept || '');

            const hasLeadership = ['president', 'core', 'head', 'vice_lead', 'vice'].includes(position) ||
                ['president', 'core'].includes(leadershipTitle) ||
                dept.includes('bdh') || dept.includes('ban dieu hanh') ||
                position.includes('trưởng') || position.includes('phó') ||
                title === 'core' || title === 'president';

            if (!hasLeadership && !leadershipTitle) {
                await db.collection('users').doc(doc.id).update({
                    role: 'member',
                    projectGroup: 'community',
                    leadershipTitle: '',
                    updatedAt: new Date().toISOString(),
                    updatedBy: decoded.uid
                });
                corrected++;
                details.push({ email: u.email, name: u.name, oldRole: u.role, newRole: 'member' });
            } else {
                skipped++;
            }
        }

        return res.status(200).json({
            success: true,
            corrected,
            skipped,
            details: details.slice(0, 50)
        });
    } catch (error) {
        console.error('Cleanup roles error:', error);
        return res.status(500).json({ error: error.message || 'Không thể cleanup roles.' });
    }
};
