const { normalizePdfAttachment } = require('../../lib/pdfAttachment');
const { sendMailWithFallback } = require('../../lib/mailer');

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
        const { to, subject, html, attachment } = req.body;
        if (!to || !subject || !html) {
            return res.status(400).json({ error: 'Missing to, subject, or html' });
        }

        const fromName = process.env.BREVO_FROM_NAME || 'Ý Niệm Điện Ảnh';
        const pdfAttachment = normalizePdfAttachment(attachment);
        const delivery = await sendMailWithFallback({
            to,
            subject,
            html: `
                <div style="max-width:600px;margin:auto;background:#0d0d0d;padding:0;border-radius:12px;overflow:hidden;font-family:'Be Vietnam Pro',Helvetica,Arial,sans-serif">
                    <div style="background:linear-gradient(135deg,#1a1008 0%,#0d0d0d 50%,#1a1008 100%);padding:20px;text-align:center;border-bottom:2px solid rgba(228,184,102,0.2)">
                        <img src="https://yniemdienanh.vercel.app/Logo/logo%20ngang.png" alt="Ý Niệm Điện Ảnh" style="max-height:40px">
                    </div>
                    <div style="padding:30px;color:#e2e8f0;font-size:14px;line-height:1.7;background:#0d0d0d">${html}</div>
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
