const { admin, getFirestore, verifyRequestToken } = require('../lib/firebaseAdmin');

const MAX_SUBMISSION_ID_LENGTH = 128;

function toMillis(value) {
    if (!value) return null;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (Number.isFinite(value._seconds)) return value._seconds * 1000;
    if (Number.isFinite(value)) return Number(value);
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
}

module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const decoded = await verifyRequestToken(req);
        const submissionId = String((req.body || {}).submissionId || '').trim();
        if (!submissionId || submissionId.length > MAX_SUBMISSION_ID_LENGTH) {
            return res.status(400).json({ error: 'submissionId không hợp lệ.' });
        }

        const db = getFirestore();
        const submissionRef = db.collection('submissions').doc(submissionId);
        const voteRef = submissionRef.collection('votes').doc(decoded.uid);
        const result = await db.runTransaction(async transaction => {
            const submissionSnap = await transaction.get(submissionRef);
            if (!submissionSnap.exists) {
                const error = new Error('Tác phẩm không tồn tại.');
                error.statusCode = 404;
                throw error;
            }
            const submission = submissionSnap.data() || {};
            if (!['approved', 'published'].includes(String(submission.status || '').toLowerCase())) {
                const error = new Error('Tác phẩm chưa mở bình chọn.');
                error.statusCode = 409;
                throw error;
            }

            const configSnap = await transaction.get(db.collection('config').doc('settings'));
            const config = configSnap.exists ? configSnap.data() || {} : {};
            const now = Date.now();
            const startsAt = toMillis(config.voteStart || config.voteStartAt);
            const endsAt = toMillis(config.voteEnd || config.voteEndAt);
            if (startsAt && now < startsAt) {
                const error = new Error('Chưa đến thời gian bình chọn.');
                error.statusCode = 409;
                throw error;
            }
            if (endsAt && now > endsAt) {
                const error = new Error('Thời gian bình chọn đã kết thúc.');
                error.statusCode = 409;
                throw error;
            }

            const voteSnap = await transaction.get(voteRef);
            const currentCount = Number.isFinite(Number(submission.votes)) ? Number(submission.votes) : 0;
            if (voteSnap.exists) return { alreadyVoted: true, voteCount: currentCount };

            transaction.set(voteRef, {
                userId: decoded.uid,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            // Set the normalized value inside the transaction so legacy string
            // counters are migrated safely and concurrent increments still retry.
            transaction.update(submissionRef, { votes: currentCount + 1 });
            return { alreadyVoted: false, voteCount: currentCount + 1 };
        });

        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        const status = Number(error.statusCode) || (error.code && String(error.code).startsWith('auth/') ? 401 : 500);
        if (status >= 500) console.error('Cast vote error:', error.message || error);
        const message = status >= 500
            ? 'Không thể ghi nhận bình chọn.'
            : (error.message || 'Không thể ghi nhận bình chọn.');
        return res.status(status).json({ error: message });
    }
};
