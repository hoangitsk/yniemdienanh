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

    const rawKeys = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEYS || '';
    const keys = rawKeys.split(',').map(k => k.trim()).filter(Boolean);
    if (keys.length === 0) {
        return res.status(500).json({ error: 'GEMINI_API_KEY chưa được cấu hình trên server.' });
    }
    const activeKey = keys[Math.floor(Math.random() * keys.length)];

    try {
        const { type, name, role, dept, intro, vision, emailType } = req.body;
        if (!name || !emailType) {
            return res.status(400).json({ error: 'Thiếu thông tin ứng viên (name) hoặc loại email (emailType)' });
        }

        const prompt = `Bạn là Trưởng ban Nhân sự của dự án "Ý Niệm Điện Ảnh" - một dự án phim ngắn phi lợi nhuận dành cho học sinh, sinh viên.
Hãy soạn thảo một email phản hồi ứng tuyển dựa trên thông tin dưới đây:
- Tên ứng viên: ${name}
- Loại đơn ứng tuyển: ${type === 'organizer' ? 'Ban Tổ Chức' : type === 'cofounder' ? 'Co-founder' : type === 'president' ? 'President' : 'Thành viên'}
- Ban ứng tuyển: ${dept || 'Cộng đồng'}
- Giới thiệu bản thân: ${intro || 'N/A'}
${vision ? `- Tầm nhìn / Ý tưởng đóng góp: ${vision}` : ''}

Loại email cần soạn: ${emailType === 'approve' ? 'Duyệt đơn và Chào mừng tham gia dự án (Email ấm áp, hào hứng, chào mừng họ gia nhập đội ngũ)' : emailType === 'reject' ? 'Từ chối đơn ứng tuyển (Email chân thành, lịch sự, cảm ơn sự quan tâm và chúc họ may mắn trong hành trình sắp tới)' : 'Mời tham gia phỏng vấn (Email hẹn phỏng vấn, đề xuất họ chọn lịch hẹn)'}.

Yêu cầu định dạng:
Trả về kết quả dưới dạng JSON có cấu trúc chính xác như sau:
{
  "subject": "Tiêu đề email hấp dẫn, ngắn gọn, phù hợp với nội dung",
  "body": "Nội dung email bằng tiếng Việt, trình bày đẹp mắt dưới dạng HTML (chỉ sử dụng các thẻ HTML cơ bản như <p>, <br>, <strong>, <ul>, <li> để định dạng. Không sử dụng thẻ <html>, <body>, <head>)."
}

Chú ý: Email cần viết bằng tiếng Việt, văn phong ấm áp, chuyên nghiệp, truyền cảm hứng và mang tính chất kết nối. Xưng hô là "Ban Nhân Sự Ý Niệm Điện Ảnh" và gọi ứng viên là "${name}".`;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${activeKey}`;
        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    responseMimeType: "application/json"
                }
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            console.error('Gemini API Error:', errData);
            return res.status(response.status).json({ error: 'Lỗi gọi API Gemini', details: errData });
        }

        const data = await response.json();
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!textResponse) {
            return res.status(500).json({ error: 'Không nhận được câu trả lời từ Gemini AI.' });
        }

        // Parse JSON output from Gemini
        const result = JSON.parse(textResponse.trim());
        res.status(200).json(result);
    } catch (err) {
        console.error('Error generating Gemini email:', err);
        res.status(500).json({ error: err.message });
    }
};
