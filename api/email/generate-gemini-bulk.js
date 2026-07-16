const { generateGeminiJson, getGeminiConfig } = require('../../lib/gemini');
const { ensureInterviewScheduleContent } = require('../../lib/emailContent');
const { PROJECT_HANDBOOK_EMAIL_CONTEXT } = require('../../lib/projectIdentity');
const { normalizeEmailSender, emailSenderPromptContext, applyEmailSenderIdentity } = require('../../lib/emailSender');
const admin = require('firebase-admin');
const { isPeopleManager } = require('../../lib/schedulePermissions');

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
    const corsOrigin = process.env.CORS_ORIGIN || 'https://yniemdienanh.vercel.app';
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const idToken = req.body && req.body.idToken;
        if (!idToken) return res.status(401).json({ error: 'Vui lòng đăng nhập để dùng AI soạn email.' });
        const db = getDb();
        const decoded = await admin.auth().verifyIdToken(idToken);
        const operatorDoc = await db.collection('users').doc(decoded.uid).get();
        if (!decoded.email_verified || !isPeopleManager(decoded, operatorDoc.exists ? operatorDoc.data() : {})) {
            return res.status(403).json({ error: 'Chỉ Admin/BTC/Ban Nhân sự mới được dùng AI soạn email.' });
        }
    } catch (authError) {
        return res.status(401).json({ error: authError.message || 'Phiên đăng nhập không hợp lệ.' });
    }

    const { keys } = getGeminiConfig();
    if (!keys.length) return res.status(500).json({ error: 'GEMINI_API_KEY chưa được cấu hình trên server.' });

    const applications = Array.isArray(req.body && req.body.applications) ? req.body.applications.slice(0, 8) : [];
    const emailType = req.body && req.body.emailType;
    const customDescription = String((req.body && req.body.customDescription) || '').trim().slice(0, 1000);
    const allowedTypes = new Set(['approve', 'round1_pass', 'interview', 'reject', 'attachment_followup', 'custom']);
    if (!applications.length || !allowedTypes.has(emailType)) {
        return res.status(400).json({ error: 'Danh sách ứng viên hoặc loại email không hợp lệ.' });
    }
    if (emailType === 'custom' && !customDescription) {
        return res.status(400).json({ error: 'Thư tùy chỉnh cần có mô tả nội dung cho AI.' });
    }

    const scheduleBaseUrl = (process.env.SCHEDULE_PUBLIC_URL || 'https://yniemdienanh.vercel.app/schedule').replace(/\/$/, '');
    const safeApplications = applications.map((app) => {
        const scheduleCode = String(app.scheduleCode || '').trim().toUpperCase();
        const safeScheduleCode = /^[A-Z][A-Z0-9_-]{3,29}$/.test(scheduleCode) ? scheduleCode : '';
        return {
            id: String(app.id || '').slice(0, 100),
            name: String(app.name || '').slice(0, 150),
            type: String(app.type || '').slice(0, 50),
            dept: String(app.dept || '').slice(0, 150),
            intro: String(app.intro || '').slice(0, 800),
            vision: String(app.vision || '').slice(0, 800),
            scheduleCode: safeScheduleCode,
            scheduleUrl: scheduleBaseUrl + (safeScheduleCode ? '/' + encodeURIComponent(safeScheduleCode) : '')
        };
    }).filter((app) => app.id && app.name);
    if (!safeApplications.length) return res.status(400).json({ error: 'Không có ứng viên hợp lệ.' });

    const sender = normalizeEmailSender(req.body);
    const typeInstruction = {
        approve: 'Thông báo được duyệt và chào mừng gia nhập dự án.',
        round1_pass: 'Chúc mừng vượt qua vòng 1; nói rõ trong 3 ngày tới sẽ có email khác để chọn lịch phỏng vấn, chưa yêu cầu chọn lịch trong thư này.',
        interview: 'Mời phỏng vấn; bắt buộc dùng đúng trường scheduleUrl riêng của từng ứng viên để chọn thời gian rảnh; nói rõ hệ thống chốt lúc 0h hằng ngày theo giờ Việt Nam và ứng viên chưa được chốt vẫn có thể cập nhật đến hết hạn.',
        reject: 'Từ chối lịch sự, chân thành, cảm ơn ứng viên và chúc họ may mắn.',
        attachment_followup: 'Gửi bổ sung tài liệu còn thiếu trong email trước; lời nhắn ngắn gọn, xin lỗi nhẹ nhàng và nhắc ứng viên xem file đính kèm.',
        custom: 'Thư tùy chỉnh theo đúng mô tả riêng của người phụ trách bên dưới.'
    }[emailType];

    const prompt = `Bạn là trợ lý soạn email cho dự án Ý Niệm Điện Ảnh.
Thông tin chính thức từ Sổ tay dự án:
${PROJECT_HANDBOOK_EMAIL_CONTEXT}

${emailSenderPromptContext(sender)}

Hãy viết RIÊNG một email tiếng Việt cho từng ứng viên trong danh sách JSON bên dưới.
Loại thư: ${typeInstruction}
${customDescription ? `Yêu cầu riêng của người phụ trách: ${customDescription}` : ''}
Văn phong ấm áp, chuyên nghiệp, tự nhiên; cá nhân hóa dựa trên ban ứng tuyển, phần giới thiệu và tầm nhìn nhưng không bịa thông tin.
Chỉ dùng HTML cơ bản trong body (<p>, <br>, <strong>, <ul>, <li>, <a>), không dùng <html>, <head>, <body>.

Ứng viên:
${JSON.stringify(safeApplications)}

Trả về JSON chính xác theo cấu trúc:
{
  "emails": [
    { "id": "giữ nguyên id đầu vào", "subject": "tiêu đề", "body": "nội dung HTML" }
  ]
}
Phải trả đủ đúng một email cho mỗi id, không thêm id khác.`;

    try {
        const result = await generateGeminiJson(prompt);
        const rawEmails = result.data && Array.isArray(result.data.emails) ? result.data.emails : [];
        const allowedIds = new Set(safeApplications.map((app) => app.id));
        const emails = rawEmails
            .filter((email) => email && allowedIds.has(String(email.id)) && email.subject && email.body)
            .map((email) => {
                const id = String(email.id);
                const application = safeApplications.find((item) => item.id === id);
                return {
                    id,
                    ...applyEmailSenderIdentity(ensureInterviewScheduleContent({ subject: String(email.subject), body: String(email.body) }, emailType, application ? application.scheduleUrl : scheduleBaseUrl), sender)
                };
            });
        if (emails.length !== safeApplications.length) {
            return res.status(502).json({ error: 'Gemini không trả đủ email cho toàn bộ ứng viên.' });
        }
        res.setHeader('X-Gemini-Model', result.model);
        return res.status(200).json({ emails, model: result.model });
    } catch (error) {
        console.error('Bulk Gemini email error:', error);
        return res.status(error.status || 500).json({ error: error.message || 'Không thể tạo email hàng loạt.' });
    }
};
