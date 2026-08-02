const { normalizePdfAttachment } = require('../../lib/pdfAttachment');
const { normalizeEmailContent } = require('../../lib/emailContent');
const { sendMailWithFallback } = require('../../lib/mailer');
const admin = require('firebase-admin');
const { isScheduleManager } = require('../../lib/schedulePermissions');

const CONCURRENCY = 3;

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

function normalizeRecipients(value) {
    const raw = Array.isArray(value) ? value.join('\n') : String(value || '');
    const emails = raw
        .split(/[\n,;]/)
        .map(item => String(item || '').trim().toLowerCase())
        .filter(Boolean);
    return Array.from(new Set(emails));
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function emailShell(bodyHtml) {
    return `
        <div style="max-width:600px;margin:auto;background:#0d0d0d;padding:0;border-radius:12px;overflow:hidden;font-family:'Be Vietnam Pro',Helvetica,Arial,sans-serif">
            <div style="background:linear-gradient(135deg,#1a1008 0%,#0d0d0d 50%,#1a1008 100%);padding:20px;text-align:center;border-bottom:2px solid rgba(228,184,102,0.2)">
                <img src="https://yniemdienanh.vercel.app/Logo/logo%20ngang.png" alt="Ý Niệm Điện Ảnh" style="max-height:40px">
            </div>
            <div style="padding:30px;color:#e2e8f0;font-size:14px;line-height:1.7;background:#0d0d0d">${bodyHtml}</div>
            <div style="background:#0a0a0a;padding:20px;text-align:center;border-top:1px solid rgba(228,184,102,0.08)">
                <p style="color:#555;font-size:12px;margin:0">© ${new Date().getFullYear()} Ý Niệm Điện Ảnh — Nơi Ý Tưởng Cất Cánh</p>
            </div>
        </div>
    `;
}

async function sendOne({ to, subject, html, attachment, fromName }) {
    try {
        const delivery = await sendMailWithFallback({
            to,
            subject,
            html,
            attachments: attachment ? [attachment] : []
        }, { fromName });
        return { email: to, status: 'sent', provider: delivery.provider };
    } catch (err) {
        return { email: to, status: 'error', error: String(err && err.message || 'Lỗi gửi email không xác định').slice(0, 500) };
    }
}

async function runPool(items, workers) {
    const results = [];
    let index = 0;
    async function worker() {
        while (index < items.length) {
            const current = index++;
            try {
                const result = await sendOne(items[current]);
                results.push(result);
            } catch (err) {
                results.push({ email: items[current].to, status: 'error', error: String(err && err.message || 'Lỗi không xác định').slice(0, 500) });
            }
        }
    }
    await Promise.all(Array.from({ length: Math.min(workers, items.length) }, worker));
    return results;
}

module.exports = async (req, res) => {
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
        const { idToken, to, subject, html, attachment, dryRun } = req.body;
        let decoded = req.authUser;
        if (!decoded) {
            if (!idToken) return res.status(401).json({ error: 'Vui lòng đăng nhập để gửi email.' });
            const db = getDb();
            decoded = await admin.auth().verifyIdToken(idToken);
            const profileDoc = await db.collection('users').doc(decoded.uid).get();
            const profile = profileDoc.exists ? profileDoc.data() : {};
            if (!decoded.email_verified || !isScheduleManager(decoded, profile)) {
                return res.status(403).json({ error: 'Chỉ HR/PR/Admin/BTC mới được gửi email.' });
            }
        }

        const recipients = normalizeRecipients(to);
        if (!recipients.length) {
            return res.status(400).json({ error: 'Chưa có địa chỉ email nào được nhập.' });
        }
        const invalid = recipients.filter(email => !isValidEmail(email));
        if (invalid.length) {
            return res.status(400).json({ error: 'Có địa chỉ email không hợp lệ: ' + invalid.join(', '), invalid });
        }
        if (recipients.length > 200) {
            return res.status(400).json({ error: 'Mỗi lần gửi tối đa 200 địa chỉ email.' });
        }
        if (!subject || !String(subject).trim()) {
            return res.status(400).json({ error: 'Thiếu tiêu đề email (subject).' });
        }
        if (!html || !String(html).trim()) {
            return res.status(400).json({ error: 'Thiếu nội dung email (html).' });
        }

        const fromName = process.env.BREVO_FROM_NAME || 'Ý Niệm Điện Ảnh';
        const pdfAttachment = normalizePdfAttachment(attachment);
        const normalizedHtml = normalizeEmailContent({ body: html }).body;
        const mailHtml = emailShell(normalizedHtml);

        if (dryRun) {
            return res.status(200).json({
                success: true,
                dryRun: true,
                total: recipients.length,
                recipients
            });
        }

        const items = recipients.map(email => ({ to: email, subject: String(subject).trim(), html: mailHtml, attachment: pdfAttachment, fromName }));
        const results = await runPool(items, CONCURRENCY);
        const sent = results.filter(item => item.status === 'sent');
        const failed = results.filter(item => item.status === 'error');

        res.status(200).json({
            success: failed.length === 0,
            total: recipients.length,
            sent: sent.length,
            failed: failed.length,
            results,
            error: failed.length ? 'Đã gửi ' + sent.length + '/' + recipients.length + ' email; có ' + failed.length + ' email thất bại.' : undefined
        });
    } catch (err) {
        console.error('Send bulk email error:', err);
        res.status(err.status || 500).json({ error: err.message });
    }
};
