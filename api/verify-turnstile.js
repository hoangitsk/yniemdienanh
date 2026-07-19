module.exports = async (req, res) => {
    var CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://yniemdienanh.vercel.app';
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ success: false, error: 'Missing token' });

        const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || '';

        if (!TURNSTILE_SECRET_KEY) {
            const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
            const devMode = !isProduction && process.env.ALLOW_TURNSTILE_DEV_MODE === 'true';
            if (devMode) return res.json({ success: true, devMode: true });
            return res.status(503).json({ success: false, error: 'Turnstile chưa được cấu hình.' });
        }

        const formData = new URLSearchParams();
        formData.append('secret', TURNSTILE_SECRET_KEY);
        formData.append('response', token);

        const cfRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: formData
        });
        const cfData = await cfRes.json();
        res.json({ success: cfData.success === true });
    } catch (err) {
        console.error('Turnstile verify error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};
