const admin = require('firebase-admin');
const { normalizePdfAttachment } = require('../../lib/pdfAttachment');
const { normalizeEmailContent } = require('../../lib/emailContent');
const { sendMailWithFallback } = require('../../lib/mailer');

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

module.exports = async (req, res) => {
    const CRON_SECRET = process.env.CRON_SECRET;
    if (CRON_SECRET && req.headers['x-cron-secret'] !== CRON_SECRET) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        const db = getDb();
        const now = new Date().toISOString();
        const snapshot = await db.collection('scheduledEmails')
            .where('status', '==', 'scheduled')
            .where('scheduledAt', '<=', now)
            .get();

        let sent = 0, failed = 0;
        const fromName = process.env.BREVO_FROM_NAME || 'Ý Niệm Điện Ảnh';

        for (const doc of snapshot.docs) {
            const email = doc.data();
            try {
                const pdfAttachment = email.attachment ? normalizePdfAttachment(email.attachment) : null;
                const normalizedHtml = normalizeEmailContent({ body: email.html }).body;
                await sendMailWithFallback({
                    to: email.to,
                    subject: email.subject,
                    html: `
                        <div style="max-width:600px;margin:auto;background:#0d0d0d;padding:0;border-radius:12px;overflow:hidden;font-family:'Be Vietnam Pro',Helvetica,Arial,sans-serif">
                            <div style="background:linear-gradient(135deg,#1a1008 0%,#0d0d0d 50%,#1a1008 100%);padding:20px;text-align:center;border-bottom:2px solid rgba(228,184,102,0.2)">
                                <img src="https://yniemdienanh.vercel.app/Logo/logo%20ngang.png" alt="Ý Niệm Điện Ảnh" style="max-height:40px">
                            </div>
                            <div style="padding:30px;color:#e2e8f0;font-size:14px;line-height:1.7;background:#0d0d0d">${normalizedHtml}</div>
                            <div style="background:#0a0a0a;padding:20px;text-align:center;border-top:1px solid rgba(228,184,102,0.08)">
                                <p style="color:#555;font-size:12px;margin:0">© ${new Date().getFullYear()} Ý Niệm Điện Ảnh</p>
                            </div>
                        </div>
                    `,
                    attachments: pdfAttachment ? [pdfAttachment] : []
                }, { fromName });

                await db.collection('scheduledEmails').doc(doc.id).update({
                    status: 'sent',
                    sentAt: new Date().toISOString()
                });
                sent++;
            } catch (err) {
                console.error(`Scheduled email ${doc.id} failed:`, err.message);
                await db.collection('scheduledEmails').doc(doc.id).update({
                    status: 'failed',
                    error: err.message,
                    lastAttempt: new Date().toISOString()
                });
                failed++;
            }
        }

        res.json({ success: true, sent, failed, checked: snapshot.size });
    } catch (err) {
        console.error('Send scheduled emails error:', err);
        res.status(500).json({ error: err.message });
    }
};
