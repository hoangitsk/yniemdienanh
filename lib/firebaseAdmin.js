const admin = require('firebase-admin');

function parseServiceAccount(raw) {
    if (!raw || typeof raw !== 'string') {
        throw new Error('FIREBASE_SERVICE_ACCOUNT chưa được cấu hình.');
    }
    let value = raw.trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    let account = JSON.parse(value);
    if (typeof account === 'string') account = JSON.parse(account);
    if (!account || !account.project_id || !account.client_email || !account.private_key) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT không hợp lệ.');
    }
    account.private_key = account.private_key.replace(/\\n/g, '\n');
    return account;
}

function ensureInitialized() {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT))
        });
    }
    return admin;
}

function getFirestore() {
    return ensureInitialized().firestore();
}

function tokenFromRequest(req) {
    const header = req.headers && (req.headers.authorization || req.headers.Authorization);
    if (typeof header === 'string' && /^Bearer\s+/i.test(header)) return header.replace(/^Bearer\s+/i, '').trim();
    const bodyToken = req.body && req.body.idToken;
    return typeof bodyToken === 'string' ? bodyToken.trim() : '';
}

async function verifyRequestToken(req, { requireEmailVerified = true } = {}) {
    const token = tokenFromRequest(req);
    if (!token) {
        const error = new Error('Thiếu thông tin xác thực.');
        error.statusCode = 401;
        throw error;
    }
    // Serverless handlers may verify the token before they need Firestore. Make
    // sure the Admin SDK is initialized in that fresh-process path as well.
    const decoded = await ensureInitialized().auth().verifyIdToken(token);
    if (requireEmailVerified && decoded.email_verified !== true) {
        const error = new Error('Tài khoản chưa xác thực email.');
        error.statusCode = 403;
        throw error;
    }
    return decoded;
}

module.exports = {
    admin,
    getFirestore,
    tokenFromRequest,
    verifyRequestToken
};
