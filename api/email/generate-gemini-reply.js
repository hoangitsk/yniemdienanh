const { generateGeminiJson, getGeminiConfig } = require('../../lib/gemini');
const { ensureInterviewScheduleContent } = require('../../lib/emailContent');

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

    const { keys } = getGeminiConfig();
    if (keys.length === 0) {
        return res.status(500).json({ error: 'GEMINI_API_KEY chưa được cấu hình trên server.' });
    }
    try {
        const { type, name, role, dept, intro, vision, emailType, customDescription } = req.body;
        if (!name || !emailType) {
            return res.status(400).json({ error: 'Thiếu thông tin ứng viên (name) hoặc loại email (emailType)' });
        }

        const scheduleUrl = process.env.SCHEDULE_PUBLIC_URL || 'https://yniemdienanh.vercel.app/schedule';
        const prompt = `Bạn là Trưởng ban Nhân sự của dự án "Ý Niệm Điện Ảnh" - một dự án phim ngắn phi lợi nhuận dành cho học sinh, sinh viên.
Hãy soạn thảo một email phản hồi ứng tuyển dựa trên thông tin dưới đây:
- Tên ứng viên: ${name}
- Loại đơn ứng tuyển: ${type === 'organizer' ? 'Ban Tổ Chức' : type === 'cofounder' ? 'Co-founder' : type === 'president' ? 'President' : 'Thành viên'}
- Ban ứng tuyển: ${dept || 'Cộng đồng'}
- Giới thiệu bản thân: ${intro || 'N/A'}
${vision ? `- Tầm nhìn / Ý tưởng đóng góp: ${vision}` : ''}

Loại email cần soạn: ${emailType === 'approve' ? 'Duyệt đơn và Chào mừng tham gia dự án (Email ấm áp, hào hứng, chào mừng họ gia nhập đội ngũ)' : emailType === 'round1_pass' ? 'Chúc mừng ứng viên đã vượt qua vòng 1. Thông báo rõ trong vòng 3 ngày tới Ban Nhân Sự sẽ gửi email tiếp theo để ứng viên lựa chọn lịch phỏng vấn; thư này chưa yêu cầu chọn lịch ngay.' : emailType === 'reject' ? 'Từ chối đơn ứng tuyển (Email chân thành, lịch sự, cảm ơn sự quan tâm và chúc họ may mắn trong hành trình sắp tới)' : emailType === 'custom' ? 'Thư tùy chỉnh theo yêu cầu riêng của HR bên dưới' : 'Mời tham gia phỏng vấn (Email hẹn phỏng vấn, đề xuất họ chọn lịch hẹn)'}.
${customDescription ? `- Yêu cầu riêng của HR: ${String(customDescription).slice(0, 1000)}` : ''}
${emailType === 'interview' ? `Bắt buộc có nút hoặc liên kết HTML đến "${scheduleUrl}" với lời mời chọn thời gian rảnh. Giải thích hệ thống chốt lịch lúc 0h hằng ngày theo giờ Việt Nam; nếu chưa được chốt, ứng viên vẫn có thể cập nhật phiếu đến hết thời hạn đợt phỏng vấn.` : ''}

Yêu cầu định dạng:
Trả về kết quả dưới dạng JSON có cấu trúc chính xác như sau:
{
  "subject": "Tiêu đề email hấp dẫn, ngắn gọn, phù hợp với nội dung",
  "body": "Nội dung email bằng tiếng Việt, trình bày đẹp mắt dưới dạng HTML (chỉ sử dụng các thẻ HTML cơ bản như <p>, <br>, <strong>, <ul>, <li> để định dạng. Không sử dụng thẻ <html>, <body>, <head>)."
}

Chú ý: Email cần viết bằng tiếng Việt, văn phong ấm áp, chuyên nghiệp, truyền cảm hứng và mang tính chất kết nối. Xưng hô là "Ban Nhân Sự Ý Niệm Điện Ảnh" và gọi ứng viên là "${name}".`;

        const result = await generateGeminiJson(prompt);
        const email = ensureInterviewScheduleContent(result.data, emailType, scheduleUrl);
        res.setHeader('X-Gemini-Model', result.model);
        res.status(200).json(email);
    } catch (err) {
        console.error('Error generating Gemini email:', err);
        if (err.attempts) console.error('Gemini fallback attempts:', err.attempts);
        res.status(err.status || 500).json({ error: err.message });
    }
};
