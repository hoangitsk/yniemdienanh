const admin = require('firebase-admin');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
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
        const requestedRole = ['member', 'organizer', 'admin'].includes(body.role) ? body.role : 'member';
        const operatorRole = clean(operator.role, 40).toLowerCase();
        const isProjectAdmin = String(decoded.email || '').toLowerCase() === 'yniemdienanh@gmail.com';
        const canGrantOrganizer = isProjectAdmin || operatorRole === 'admin';
        const canGrantLeadership = canGrantOrganizer;
        const role = requestedRole === 'admin'
            ? (isProjectAdmin ? 'admin' : 'member')
            : requestedRole === 'organizer' && canGrantOrganizer ? 'organizer' : 'member';
        const requestedProjectGroup = clean(body.projectGroup, 40).toLowerCase();
        const projectGroup = requestedProjectGroup === 'organizer'
            ? (canGrantOrganizer && role === 'organizer' ? 'organizer' : 'community')
            : (['candidate', 'community'].includes(requestedProjectGroup)
                ? requestedProjectGroup
                : (role === 'organizer' ? 'organizer' : 'community'));
        const requestedLeadershipTitle = clean(body.leadershipTitle, 40).toLowerCase();
        const leadershipTitle = canGrantLeadership && ['founder', 'cofounder', 'president', 'core'].includes(requestedLeadershipTitle)
            ? requestedLeadershipTitle
            : '';
        // Department/position feed authorization helpers, so only Admin can
        // assign them. A people manager may still create a safe member/candidate.
        const dept = canGrantOrganizer ? clean(body.dept, 160) : '';
        const position = canGrantOrganizer ? clean(body.position, 80) : '';
        if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Họ tên hoặc email không hợp lệ.' });
        }

        let authUser;
        let existingProfile = null;
        let created = false;
        try {
            authUser = await admin.auth().getUserByEmail(email);
            const existingProfileDoc = await db.collection('users').doc(authUser.uid).get();
            existingProfile = existingProfileDoc.exists ? existingProfileDoc.data() : null;
            const existingRole = clean(existingProfile && existingProfile.role, 40).toLowerCase();
            const existingProjectGroup = clean(existingProfile && existingProfile.projectGroup, 40).toLowerCase();
            const existingLeadershipTitle = clean(existingProfile && existingProfile.leadershipTitle, 40).toLowerCase();
            if (!isProjectAdmin && existingRole === 'admin') {
                return res.status(403).json({ error: 'Chỉ tài khoản quản trị dự án được thay đổi tài khoản Admin.' });
            }
            if (!canGrantLeadership && Boolean(existingLeadershipTitle)) {
                return res.status(403).json({ error: 'Chỉ Admin được thay đổi chức danh lãnh đạo.' });
            }
            if (!canGrantOrganizer && (
                ['admin', 'organizer'].includes(existingRole) ||
                existingProjectGroup === 'organizer' ||
                Boolean(existingLeadershipTitle)
            )) {
                return res.status(403).json({ error: 'Bạn không có quyền thay đổi tài khoản quản trị hoặc ban tổ chức.' });
            }
            authUser = await admin.auth().updateUser(authUser.uid, {
                displayName: name,
                disabled: false
            });
        } catch (error) {
            if (error.code !== 'auth/user-not-found') throw error;
            created = true;
            const password = crypto.randomBytes(24).toString('base64url') + 'A1!';
            authUser = await admin.auth().createUser({ email, password, displayName: name, emailVerified: false });
        }

        const profile = {
            id: authUser.uid,
            name,
            email,
            role,
            projectGroup,
            leadershipTitle: projectGroup === 'organizer' ? leadershipTitle : '',
            dept,
            position,
            emailVerified: authUser.emailVerified === true,
            updatedAt: new Date().toISOString(),
            updatedBy: decoded.uid
        };
        try {
            await db.collection('users').doc(authUser.uid).set(profile, { merge: true });
        } catch (profileError) {
            if (created) {
                try { await admin.auth().deleteUser(authUser.uid); } catch (rollbackError) {
                    console.error('Managed user rollback failed:', rollbackError.message || rollbackError);
                }
            }
            throw profileError;
        }

        let inviteSent = false;
        if (created || !authUser.emailVerified) {
            try {
                const fromEmail = process.env.BREVO_FROM_EMAIL;
                if (!fromEmail || !process.env.BREVO_SMTP_LOGIN || !process.env.BREVO_SMTP_KEY) {
                    throw new Error('SMTP invitation is not configured.');
                }
                const continueUrl = String(process.env.PUBLIC_APP_URL || 'https://yniemdienanh.vercel.app').replace(/\/$/, '') + '/register?tab=login';
                const [verificationLink, passwordLink] = await Promise.all([
                    admin.auth().generateEmailVerificationLink(email, { url: continueUrl }),
                    admin.auth().generatePasswordResetLink(email, { url: continueUrl })
                ]);
                const transporter = nodemailer.createTransport({
                    host: 'smtp-relay.brevo.com', port: 587, secure: false,
                    auth: { user: process.env.BREVO_SMTP_LOGIN, pass: process.env.BREVO_SMTP_KEY }
                });
                await transporter.sendMail({
                    from: `"${process.env.BREVO_FROM_NAME || 'Ý Niệm Điện Ảnh'}" <${fromEmail}>`,
                    to: email,
                    subject: 'Lời mời kích hoạt tài khoản Ý Niệm Điện Ảnh',
                    text: `Xin chào ${name},\n\nVui lòng xác thực email: ${verificationLink}\n\nSau đó đặt mật khẩu: ${passwordLink}\n\nNếu bạn không mong đợi lời mời này, hãy bỏ qua email.`
                });
                inviteSent = true;
            } catch (inviteError) {
                console.error('Managed user invitation failed:', inviteError.message || inviteError);
            }
        }
        return res.status(200).json({ success: true, created, inviteSent, user: profile });
    } catch (error) {
        console.error('Upsert managed user error:', error);
        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn.' });
        }
        return res.status(500).json({ error: 'Không thể tạo hoặc cập nhật tài khoản.' });
    }
};
