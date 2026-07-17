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

module.exports = async function assignScheduleParticipant(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
        const body = req.body || {};
        const email = String(body.candidateEmail || '').trim().toLowerCase();
        const pollCode = String(body.pollCode || '').trim().toUpperCase();
        if (!body.idToken || !email || !pollCode) {
            return res.status(400).json({ error: 'Thiếu tài khoản ứng viên hoặc mã lịch cần gửi.' });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Email ứng viên không hợp lệ.' });
        }

        const db = getDb();
        const decoded = await admin.auth().verifyIdToken(body.idToken);
        const operatorDoc = await db.collection('users').doc(decoded.uid).get();
        const operator = operatorDoc.exists ? operatorDoc.data() : {};
        if (!decoded.email_verified || !isScheduleManager(decoded, operator)) {
            return res.status(403).json({ error: 'Chỉ Admin/BTC/HR/PR mới được cấp lịch cho ứng viên.' });
        }

        let candidate = null;
        try {
            candidate = await admin.auth().getUserByEmail(email);
        } catch (error) {
            if (error.code !== 'auth/user-not-found') throw error;
        }

        const pollSnap = await db.collection('availabilityPolls').where('code', '==', pollCode).limit(1).get();
        if (pollSnap.empty) return res.status(404).json({ error: 'Không tìm thấy đợt vote ' + pollCode + '.' });
        const pollDoc = pollSnap.docs[0];
        const poll = pollDoc.data() || {};
        if (poll.status !== 'open') return res.status(409).json({ error: 'Đợt vote này không còn mở.' });
        if (body.expectedType && poll.type !== body.expectedType) {
            return res.status(409).json({ error: body.expectedType === 'interview' ? 'Thư phỏng vấn chỉ được gửi với lịch vote phỏng vấn.' : 'Loại lịch không phù hợp với thư đang gửi.' });
        }

        const candidateName = String(body.candidateName || (candidate && candidate.displayName) || email.split('@')[0]).trim().slice(0, 150);
        await db.runTransaction(async transaction => {
            const freshDoc = await transaction.get(pollDoc.ref);
            if (!freshDoc.exists || freshDoc.data().status !== 'open') throw new Error('Đợt vote vừa bị đóng.');
            const fresh = freshDoc.data();
            const participantIds = Array.isArray(fresh.participantIds) ? fresh.participantIds.slice() : [];
            const participantNames = Array.isArray(fresh.participantNames) ? fresh.participantNames.slice(0, participantIds.length) : [];
            const participantEmails = Array.isArray(fresh.participantEmails)
                ? fresh.participantEmails.map(item => String(item).trim().toLowerCase()).filter(Boolean)
                : [];
            while (participantNames.length < participantIds.length) participantNames.push('');
            if (candidate) {
                const existingIndex = participantIds.indexOf(candidate.uid);
                if (existingIndex === -1) {
                    participantIds.push(candidate.uid);
                    participantNames.push(candidateName);
                } else {
                    participantNames[existingIndex] = candidateName;
                }
            }
            if (!participantEmails.includes(email)) participantEmails.push(email);
            transaction.update(pollDoc.ref, { participantIds, participantNames, participantEmails, updatedAt: new Date().toISOString() });
        });

        const now = new Date().toISOString();
        const profileUpdate = {
            activeScheduleCode: pollCode,
            recruitmentStage: poll.type === 'meeting' ? 'meeting_vote' : 'interview_vote',
            updatedAt: now,
            updatedBy: decoded.uid
        };
        if (poll.type === 'meeting') profileUpdate.meetingPollCode = pollCode;
        else profileUpdate.interviewPollCode = pollCode;
        if (candidate) await db.collection('users').doc(candidate.uid).set(profileUpdate, { merge: true });

        if (body.applicationId !== undefined && body.applicationId !== null && String(body.applicationId).trim()) {
            const applicationUpdate = {
                activeScheduleCode: pollCode,
                interviewPollCode: poll.type === 'interview' ? pollCode : null,
                meetingPollCode: poll.type === 'meeting' ? pollCode : null,
                recruitmentStage: profileUpdate.recruitmentStage,
                scheduleAssignedAt: now,
                scheduleAssignedBy: decoded.uid
            };
            if (candidate) applicationUpdate.approvedUserId = candidate.uid;
            await db.collection('applications').doc(String(body.applicationId)).set(applicationUpdate, { merge: true });
        }

        return res.status(200).json({
            success: true,
            poll: { id: pollDoc.id, code: pollCode, title: poll.title || '', type: poll.type },
            user: { id: candidate ? candidate.uid : null, email, name: candidateName, accountExists: !!candidate }
        });
    } catch (error) {
        console.error('Assign schedule participant error:', error);
        const status = error.code === 'auth/id-token-expired' ? 401 : 500;
        return res.status(status).json({ error: error.message || 'Không thể cấp lịch cho ứng viên.' });
    }
};
