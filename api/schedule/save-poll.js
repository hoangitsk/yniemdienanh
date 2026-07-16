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

module.exports = async function saveAvailabilityPoll(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
        const body = req.body || {};
        if (!body.idToken || !body.pollId) {
            return res.status(400).json({ error: 'Thiếu thông tin xác thực hoặc mã đợt vote.' });
        }
        const db = getDb();
        const decoded = await admin.auth().verifyIdToken(body.idToken);
        const operatorDoc = await db.collection('users').doc(decoded.uid).get();
        const operator = operatorDoc.exists ? operatorDoc.data() : {};
        const isProjectAdmin = String(decoded.email || '').toLowerCase() === 'yniemdienanh@gmail.com';
        if (!decoded.email_verified || (!isProjectAdmin && !['admin', 'organizer'].includes(operator.role))) {
            return res.status(403).json({ error: 'Chỉ Admin/BTC mới được tạo đợt vote.' });
        }

        const pollId = String(body.pollId).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 150);
        if (!pollId) return res.status(400).json({ error: 'Mã đợt vote không hợp lệ.' });
        const ref = db.collection('availabilityPolls').doc(pollId);

        if (body.action === 'delete') {
            const schedulesSnap = await db.collection('meetingSchedules').where('pollId', '==', pollId).get();
            const refs = [ref, ...schedulesSnap.docs.map(doc => doc.ref)];
            for (let offset = 0; offset < refs.length; offset += 450) {
                const batch = db.batch();
                refs.slice(offset, offset + 450).forEach(docRef => batch.delete(docRef));
                await batch.commit();
            }
            return res.status(200).json({ success: true, deleted: true, pollId, deletedResponses: schedulesSnap.size });
        }

        if (!body.poll) return res.status(400).json({ error: 'Thiếu dữ liệu đợt vote.' });

        const input = body.poll;
        const title = String(input.title || '').trim().slice(0, 200);
        const type = input.type === 'meeting' ? 'meeting' : 'interview';
        const startDate = String(input.startDate || '');
        const dayCount = Math.max(1, Math.min(14, Number(input.dayCount || 7)));
        const participantIds = Array.isArray(input.participantIds)
            ? [...new Set(input.participantIds.map(id => String(id)).filter(Boolean))].slice(0, 1000)
            : [];
        const participantNames = Array.isArray(input.participantNames)
            ? input.participantNames.map(name => String(name).slice(0, 200)).slice(0, participantIds.length)
            : [];
        const isPublic = input.isPublic === true;
        if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
            return res.status(400).json({ error: 'Tên đợt hoặc ngày bắt đầu không hợp lệ.' });
        }
        if (!isPublic && !participantIds.length) {
            return res.status(400).json({ error: 'Hãy chọn ít nhất một tài khoản hoặc cho phép tất cả.' });
        }

        const now = new Date().toISOString();
        const allowedStatuses = ['draft', 'open', 'closed', 'archived'];
        const counterRef = db.collection('systemCounters').doc('availabilityPollCodes');
        let poll;
        await db.runTransaction(async transaction => {
            const [existingDoc, counterDoc] = await Promise.all([
                transaction.get(ref),
                transaction.get(counterRef)
            ]);
            const existing = existingDoc.exists ? existingDoc.data() : null;
            let code = String(existing && existing.code || '').toUpperCase();
            if (!/^YNDA\d+$/.test(code)) {
                const next = Math.max(1, Number(counterDoc.exists && counterDoc.data().next || 1));
                code = 'YNDA' + next;
                transaction.set(counterRef, { next: next + 1, updatedAt: now }, { merge: true });
            }
            const requestedStatus = allowedStatuses.includes(input.status) ? input.status : (existing ? existing.status : 'draft');
            poll = {
                code, title, type, startDate, dayCount, participantIds, participantNames, isPublic,
                status: requestedStatus,
                createdBy: existing ? existing.createdBy : decoded.uid,
                createdAt: existing ? existing.createdAt : now,
                updatedAt: now
            };
            transaction.set(ref, poll, { merge: false });
        });
        return res.status(200).json({ poll: { id: pollId, ...poll } });
    } catch (error) {
        console.error('Save availability poll error:', error);
        return res.status(error.code === 'auth/id-token-expired' ? 401 : 500).json({ error: error.message || 'Không thể lưu đợt vote.' });
    }
};
