module.exports = async (req, res) => {
    var CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://yniemdienanh.com';
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
            return res.json({ success: true, devMode: true });
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
