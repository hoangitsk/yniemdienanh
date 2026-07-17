const { normalizePdfAttachment } = require('../../lib/pdfAttachment');
const { normalizeEmailContent } = require('../../lib/emailContent');
const { sendMailWithFallback } = require('../../lib/mailer');
const admin = require('firebase-admin');
const { isScheduleManager } = require('../../lib/schedulePermissions');

function getDb() {
    if (!admin.apps.length) {
        let raw = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT chÆ°a Ä‘Æ°á»£c cáº¥u hÃ¬nh.');
        raw = raw.trim().replace(/^"|"$/g, '');
        let account = JSON.parse(raw);
        if (typeof account === 'string') account = JSON.parse(account);
        if (account.private_key) account.private_key = account.private_key.replace(/\\n/g, '\n');
        admin.initializeApp({ credential: admin.credential.cert(account) });
    }
    return admin.firestore();
}

module.exports = async (req, res) => {
    // Enable CORS
    var CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://yniemdienanh.vercel.app';
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { idToken, to, subject, html, attachment } = req.body;
        if (!idToken) return res.status(401).json({ error: 'Vui lÃ²ng Ä‘Äƒng nháº­p Ä‘á»ƒ gá»­i email.' });
        const db = getDb();
        const decoded = await admin.auth().verifyIdToken(idToken);
        const profileDoc = await db.collection('users').doc(decoded.uid).get();
        const profile = profileDoc.exists ? profileDoc.data() : {};
        if (!decoded.email_verified || !isScheduleManager(decoded, profile)) {
            return res.status(403).json({ error: 'Chá»‰ HR/PR/Admin/BTC má»›i Ä‘Æ°á»£c gá»­i email.' });
        }
        if (!to || !subject || !html) {
            return res.status(400).json({ error: 'Missing to, subject, or html' });
        }

        const fromName = process.env.BREVO_FROM_NAME || 'Ý Niệm Điện Ảnh';
        const pdfAttachment = normalizePdfAttachment(attachment);
        const normalizedHtml = normalizeEmailContent({ body: html }).body;
        const delivery = await sendMailWithFallback({
            to,
            subject,
            html: `
                <div style="max-width:600px;margin:auto;background:#0d0d0d;padding:0;border-radius:12px;overflow:hidden;font-family:'Be Vietnam Pro',Helvetica,Arial,sans-serif">
                    <div style="background:linear-gradient(135deg,#1a1008 0%,#0d0d0d 50%,#1a1008 100%);padding:20px;text-align:center;border-bottom:2px solid rgba(228,184,102,0.2)">
                        <img src="https://yniemdienanh.vercel.app/Logo/logo%20ngang.png" alt="Ý Niệm Điện Ảnh" style="max-height:40px">
                    </div>
                    <div style="padding:30px;color:#e2e8f0;font-size:14px;line-height:1.7;background:#0d0d0d">${normalizedHtml}</div>
                    <div style="background:#0a0a0a;padding:20px;text-align:center;border-top:1px solid rgba(228,184,102,0.08)">
                        <p style="color:#555;font-size:12px;margin:0">© ${new Date().getFullYear()} Ý Niệm Điện Ảnh — Nơi Ý Tưởng Cất Cánh</p>
                    </div>
                </div>
            `,
            attachments: pdfAttachment ? [pdfAttachment] : []
        }, { fromName });

        res.status(200).json({ success: true, provider:delivery.provider });
    } catch (err) {
        console.error('Send custom email error:', err);
        res.status(err.status || 500).json({ error: err.message });
    }
};
