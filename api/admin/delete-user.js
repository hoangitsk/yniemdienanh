const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
const FIREBASE_SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT;
if (FIREBASE_SERVICE_ACCOUNT && !admin.apps.length) {
    try {
        let serviceAccountStr = FIREBASE_SERVICE_ACCOUNT.trim();
        if (serviceAccountStr.startsWith('"') && serviceAccountStr.endsWith('"')) {
            serviceAccountStr = serviceAccountStr.slice(1, -1);
        }
        let serviceAccount = JSON.parse(serviceAccountStr);
        if (typeof serviceAccount === 'string') {
            serviceAccount = JSON.parse(serviceAccount);
        }
        if (serviceAccount.private_key) {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (e) {
        console.error("Firebase admin init failed:", e);
    }
}

module.exports = async (req, res) => {
    var CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://yniemdienanh.com';
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { idToken, targetUid } = req.body;
        if (!idToken || !targetUid) {
            return res.status(400).json({ error: 'Missing idToken or targetUid' });
        }

        // Verify the admin ID token
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const callerUid = decodedToken.uid;
        
        // Fetch caller document from Firestore to verify admin role
        let isAdmin = false;
        if (decodedToken.email === 'yniemdienanh@gmail.com') {
            isAdmin = true;
        } else {
            try {
                const callerDoc = await admin.firestore().collection('users').doc(callerUid).get();
                if (callerDoc.exists && callerDoc.data().role === 'admin') {
                    isAdmin = true;
                }
            } catch (dbErr) {
                console.warn('Firestore failed during admin check:', dbErr);
            }
        }

        if (!isAdmin) {
            return res.status(403).json({ error: 'Unauthorized. Only admin can delete accounts.' });
        }

        // 1. Delete from Firebase Authentication
        try {
            await admin.auth().deleteUser(targetUid);
        } catch (authErr) {
            console.error('Failed to delete user from Firebase Auth:', authErr.message || authErr);
            return res.status(500).json({
                success: false,
                error: 'Không thể xoá tài khoản khỏi Firebase Authentication. Vui lòng thử lại hoặc xoá thủ công trên Firebase Console.',
                detail: authErr.message
            });
        }

        // 2. Delete from Firestore users collection
        try {
            await admin.firestore().collection('users').doc(targetUid).delete();
        } catch (dbErr) {
            console.warn('Failed to delete user document from Firestore:', dbErr.message || dbErr);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ error: err.message });
    }
};
