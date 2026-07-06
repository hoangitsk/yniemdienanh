const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
const FIREBASE_SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT;
if (FIREBASE_SERVICE_ACCOUNT && !admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
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
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
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
        const callerDoc = await admin.firestore().collection('users').doc(callerUid).get();
        if (!callerDoc.exists || callerDoc.data().role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized. Only admin can delete accounts.' });
        }

        // 1. Delete from Firebase Authentication
        try {
            await admin.auth().deleteUser(targetUid);
        } catch (authErr) {
            console.warn('User not found in Firebase Auth or failed to delete:', authErr.message || authErr);
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
