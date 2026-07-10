module.exports = async (req, res) => {
    var CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://yniemdienanh.vercel.app';
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
    res.setHeader('Cache-Control', 'public, max-age=300');

    res.json({
        turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || ''
    });
};
