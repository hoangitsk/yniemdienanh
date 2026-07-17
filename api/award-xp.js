const admin = require('firebase-admin');

// Initialize Firebase Admin
let db = null;
const FIREBASE_SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT;
if (FIREBASE_SERVICE_ACCOUNT) {
    try {
        if (!admin.apps.length) {
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
        }
        db = admin.firestore();
    } catch (err) {
        console.error("Failed to initialize Firebase Admin in award-xp:", err);
    }
}

const XP_TABLE = {
    onboarding: { xp: 50, desc: 'Complete onboarding + code of conduct', cap: 'Once' },
    workshop_artifact: { xp: 40, desc: 'Submit workshop artifact', cap: 'Once/workshop' },
    learning_checkpoint: { xp: 20, desc: 'Pass learning checkpoint', cap: 'Once/checkpoint' },
    mini_challenge: { xp: 60, desc: 'Complete mini-challenge', cap: 'Once/challenge' },
    peer_review: { xp: 15, desc: 'Useful peer review', cap: '4/week' },
    close_loop: { xp: 30, desc: 'Close feedback loop with revision', cap: '2/challenge' },
    milestone: { xp: 50, desc: 'Production milestone completed', cap: 'Once/milestone' },
    final_submission: { xp: 150, desc: 'Final compliant submission', cap: 'Once/season' }
};

module.exports = async (req, res) => {
    var CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://yniemdienanh.vercel.app';
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!db) {
        return res.status(500).json({ error: 'Firebase Service Account is not configured' });
    }

    const { idToken, actionType, referenceId } = req.body;
    if (!idToken || !actionType) {
        return res.status(400).json({ error: 'Missing idToken or actionType' });
    }

    const xpRule = XP_TABLE[actionType];
    if (!xpRule) {
        return res.status(400).json({ error: 'Invalid actionType' });
    }

    try {
        // 1. Verify idToken
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;

        // Run in transaction to enforce anti-abuse and caps
        const result = await db.runTransaction(async (t) => {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            // Fetch today's ledger entries for the user to enforce daily cap of 150 XP
            const ledgerRef = db.collection('xp_ledger');
            const todayQuery = ledgerRef.where('userId', '==', uid).where('createdAt', '>=', startOfDay.toISOString());
            const todaySnap = await t.get(todayQuery);

            let todayXP = 0;
            todaySnap.forEach(doc => {
                todayXP += doc.data().xp || 0;
            });

            if (todayXP >= 150) {
                throw new Error('Bạn đã đạt giới hạn 150 XP tối đa trong ngày hôm nay.');
            }

            // Enforce rule constraints
            if (actionType === 'onboarding') {
                const onboardingQuery = ledgerRef.where('userId', '==', uid).where('actionType', '==', 'onboarding');
                const snap = await t.get(onboardingQuery);
                if (!snap.empty) {
                    throw new Error('Bạn đã nhận XP cho khảo sát onboarding rồi.');
                }
            } else if (actionType === 'peer_review') {
                const startOfWeek = new Date();
                startOfWeek.setDate(startOfWeek.getDate() - 7);
                const weekQuery = ledgerRef.where('userId', '==', uid).where('actionType', '==', 'peer_review').where('createdAt', '>=', startOfWeek.toISOString());
                const snap = await t.get(weekQuery);
                if (snap.size >= 4) {
                    throw new Error('Bạn đã đạt giới hạn nhận 4 lượt XP góp ý đồng nghiệp (peer review) trong tuần này.');
                }
            } else if (referenceId) {
                // Check if specific reference has already been rewarded
                const refQuery = ledgerRef.where('userId', '==', uid).where('actionType', '==', actionType).where('referenceId', '==', referenceId);
                const snap = await t.get(refQuery);
                if (!snap.empty) {
                    throw new Error('Hoạt động này đã được ghi nhận và tích lũy XP trước đó.');
                }
            }

            // Calculate allowed XP within daily limit
            let xpToAward = xpRule.xp;
            if (todayXP + xpToAward > 150) {
                xpToAward = 150 - todayXP; // Trim to fit the cap
            }

            if (xpToAward <= 0) {
                throw new Error('Giao dịch vượt quá giới hạn 150 XP tối đa hàng ngày.');
            }

            // Write append-only ledger entry
            const newDocRef = ledgerRef.doc();
            t.set(newDocRef, {
                id: newDocRef.id,
                userId: uid,
                actionType: actionType,
                referenceId: referenceId || null,
                xp: xpToAward,
                reason: xpRule.desc,
                createdAt: new Date().toISOString()
            });

            // Update user profile total XP
            const userProfileRef = db.collection('users').doc(uid);
            const userSnap = await t.get(userProfileRef);
            if (userSnap.exists) {
                const currentXP = userSnap.data().xp || 0;
                t.update(userProfileRef, {
                    xp: currentXP + xpToAward,
                    updatedAt: new Date().toISOString()
                });
            }

            return { xpAwarded: xpToAward, totalToday: todayXP + xpToAward };
        });

        return res.status(200).json({ success: true, xpEarned: result.xpAwarded, totalToday: result.totalToday });
    } catch (e) {
        console.error("XP Award Error:", e.message);
        return res.status(400).json({ error: e.message });
    }
};
