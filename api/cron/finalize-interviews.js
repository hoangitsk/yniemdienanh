const { finalizeInterviews } = require('../../lib/interviewFinalizer');

module.exports = async function finalizeInterviewCron(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error:'Method not allowed' });
    const expected = process.env.CRON_SECRET;
    if (!expected || req.headers.authorization !== `Bearer ${expected}`) {
        return res.status(401).json({ error:'Unauthorized' });
    }
    try {
        const summary = await finalizeInterviews();
        return res.status(summary.errors.length ? 207 : 200).json({ success:!summary.errors.length, ...summary });
    } catch (error) {
        console.error('Interview finalizer error:', error);
        return res.status(500).json({ error:error.message || 'Không thể chốt lịch phỏng vấn.' });
    }
};
