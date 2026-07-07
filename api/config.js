module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=300');

    res.json({
        turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || ''
    });
};
