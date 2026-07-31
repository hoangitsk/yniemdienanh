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

function canonDept(value) {
    const s = String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^ban\s+/, '');
    if (s.includes('media') || s.includes('thiet ke') || s.includes('edit')) return 'media';
    if (s.includes('nhan su') || s === 'hr') return 'nhan su';
    if (s.includes('truyen thong') || s.includes('pr') || s.includes('marketing') || s.includes('mkt')) return 'truyen thong';
    if (s.includes('noi dung')) return 'noi dung';
    if (s.includes('duyet bai')) return 'duyet bai';
    return s;
}

const ALLOWED_ORIGINS = [
    'https://yniemdienanh.vercel.app',
    'https://yniemdienanh.gt.tc',
    'http://localhost:24687'
];

module.exports = async function recruitmentPositions(req, res) {
    const requestOrigin = req.headers.origin || '';
    const allowed = ALLOWED_ORIGINS.indexOf(requestOrigin) !== -1 || process.env.CORS_ORIGIN === requestOrigin;
    if (allowed) {
        res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    try {
        const db = getDb();
        const usersSnap = await db.collection('users').get();
        const filled = {};
        usersSnap.forEach(doc => {
            const u = doc.data() || {};
            if (u.projectGroup === 'candidate') return;
            const dept = u.dept || u.projectGroup || '';
            if (!dept) return;
            const uPos = String(u.position || u.leadershipTitle || u.role || '').toLowerCase();
            const isCore = uPos.includes('core') || uPos.includes('trưởng') || uPos.includes('lead') || u.isCore === true;
            const isVice = uPos.includes('vice') || uPos.includes('phó') || uPos.includes('pho');
            if (!isCore && !isVice) return;
            const key = canonDept(dept);
            const entry = filled[key] || (filled[key] = { core: false, vice_lead: false });
            if (isCore) entry.core = true;
            if (isVice) entry.vice_lead = true;
        });
        res.setHeader('Cache-Control', 'public, max-age=120');
        return res.status(200).json({ filled });
    } catch (error) {
        console.error('Recruitment positions error:', error);
        return res.status(500).json({ error: error.message || 'Không thể tải danh sách vị trí.' });
    }
};
