const PayOS = require('@payos/node');

const PAYOS_CLIENT_ID = process.env.PAYOS_CLIENT_ID || "";
const PAYOS_API_KEY = process.env.PAYOS_API_KEY || "";
const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY || "";

const PAYOS_ENABLED = !!(PAYOS_CLIENT_ID && PAYOS_API_KEY && PAYOS_CHECKSUM_KEY);
const payos = PAYOS_ENABLED ? new PayOS(PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY) : null;

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
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
        if (!PAYOS_ENABLED) {
            return res.status(400).json({ error: "PayOS chưa được cấu hình. Vui lòng thiết lập biến môi trường." });
        }

        const { amount, description, orderCode } = req.body;
        const amountNum = parseInt(amount || 5000, 10);
        const descStr = String(description || "Thanh toan").substring(0, 25);
        const orderNum = parseInt(orderCode || Math.floor(Date.now() % 100000000), 10);

        // Get the host of the request dynamically for success/cancel redirects
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const BASE_URL = `${protocol}://${host}`;

        const paymentData = {
            orderCode: orderNum,
            amount: amountNum,
            description: descStr,
            cancelUrl: `${BASE_URL}/payment-cancel?orderCode=${orderNum}`,
            returnUrl: `${BASE_URL}/payment-success?orderCode=${orderNum}`
        };

        const paymentLink = await payos.createPaymentLink(paymentData);
        res.json({
            checkoutUrl: paymentLink.checkoutUrl,
            qrCode: paymentLink.qrCode,
            orderCode: paymentLink.orderCode
        });
    } catch (err) {
        console.error('PayOS create payment error:', err);
        res.status(400).json({ error: err.message });
    }
};
