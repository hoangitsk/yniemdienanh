const admin = require('firebase-admin');
const crypto = require('crypto');
const { isPeopleManager } = require('../../lib/schedulePermissions');

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

function clean(value, max) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

module.exports = async function upsertManagedUser(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
        const body = req.body || {};
        if (!body.idToken) return res.status(401).json({ error: 'Vui lòng đăng nhập lại.' });
        const db = getDb();
        const decoded = await admin.auth().verifyIdToken(body.idToken);
        const operatorDoc = await db.collection('users').doc(decoded.uid).get();
        const operator = operatorDoc.exists ? operatorDoc.data() : {};
        if (!decoded.email_verified || !isPeopleManager(decoded, operator)) {
            return res.status(403).json({ error: 'Chỉ Admin/BTC/Ban Nhân sự mới được quản lý tài khoản.' });
        }

        const email = clean(body.email, 254).toLowerCase();
        const name = clean(body.name, 150);
        const requestedRole = ['member', 'organizer'].includes(body.role) ? body.role : 'member';
        const operatorRole = clean(operator.role, 40).toLowerCase();
        const canGrantOrganizer = String(decoded.email || '').toLowerCase() === 'yniemdienanh@gmail.com' || ['admin', 'organizer'].includes(operatorRole);
        const role = requestedRole === 'organizer' && canGrantOrganizer ? 'organizer' : 'member';
        const dept = clean(body.dept, 160);
        const position = clean(body.position, 80);
        if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Họ tên hoặc email không hợp lệ.' });
        }

        let authUser;
        let created = false;
        try {
            authUser = await admin.auth().getUserByEmail(email);
            authUser = await admin.auth().updateUser(authUser.uid, {
                displayName: name,
                disabled: false,
                emailVerified: true
            });
        } catch (error) {
            if (error.code !== 'auth/user-not-found') throw error;
            created = true;
            const password = crypto.randomBytes(24).toString('base64url') + 'A1!';
            authUser = await admin.auth().createUser({ email, password, displayName: name, emailVerified: true });
        }

        const profile = {
            id: authUser.uid,
            name,
            email,
            role,
            dept,
            position,
            emailVerified: true,
            updatedAt: new Date().toISOString(),
            updatedBy: decoded.uid
        };
        await db.collection('users').doc(authUser.uid).set(profile, { merge: true });
        return res.status(200).json({ success: true, created, user: profile });
    } catch (error) {
        console.error('Upsert managed user error:', error);
        return res.status(error.code === 'auth/id-token-expired' ? 401 : 500).json({ error: error.message || 'Không thể tạo hoặc cập nhật tài khoản.' });
    }
};
