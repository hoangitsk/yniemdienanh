const { getFirestore } = require('../lib/firebaseAdmin');

module.exports = async (req, res) => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const code = String(req.query && (req.query.code || req.query.id) || '').trim();
    if (!code || code.length > 128 || !/^[A-Za-z0-9_-]+$/.test(code)) {
        return res.status(400).json({ error: 'Mã chứng nhận không hợp lệ.' });
    }
    try {
        const db = getFirestore();
        let snap = await db.collection('certificates').doc(code).get();
        if (!snap.exists) {
            const query = await db.collection('certificates').where('id', '==', code).limit(1).get();
            snap = query.empty ? null : query.docs[0];
        }
        if (!snap || !snap.exists) return res.status(404).json({ error: 'Không tìm thấy chứng nhận.' });
        const data = snap.data() || {};
        // Return only fields needed for public verification; never expose uid or internal metadata.
        return res.json({
            id: String(data.id || snap.id),
            userName: String(data.userName || ''),
            type: String(data.type || ''),
            typeCode: String(data.typeCode || ''),
            achievement: String(data.achievement || ''),
            season: data.season == null ? '' : String(data.season),
            issuedAt: data.issuedAt || null,
            approvedBy: String(data.approvedBy || ''),
            status: data.status === 'revoked' || data.status === 'revok' ? 'revoked' : 'active'
        });
    } catch (error) {
        console.error('Certificate verification error:', error.message || error);
        return res.status(503).json({ error: 'Dịch vụ xác minh chứng nhận tạm thời không khả dụng.' });
    }
};
