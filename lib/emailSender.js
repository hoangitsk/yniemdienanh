function clean(value, maxLength) {
    return String(value || '').trim().slice(0, maxLength);
}

function normalizeEmailSender(body) {
    const input = body && typeof body.sender === 'object' && body.sender ? body.sender : {};
    const rawRole = clean(input.role, 80).toLowerCase();
    const roleLabels = {
        admin: 'Quản trị viên',
        organizer: 'Ban Tổ Chức',
        member: 'Thành viên'
    };
    return {
        name: clean(input.name, 150) || 'Đội ngũ Ý Niệm Điện Ảnh',
        email: clean(input.email, 254),
        role: roleLabels[rawRole] || clean(input.role, 80) || 'Thành viên',
        dept: clean(input.dept, 150)
    };
}

function emailSenderPromptContext(sender) {
    const position = sender.dept || sender.role;
    return `Người phụ trách soạn và gửi thư thực tế:
- Họ tên: ${sender.name}
- Tài khoản đang đăng nhập: ${sender.email || 'Không có email tài khoản'}
- Vai trò hệ thống: ${sender.role}
- Ban/phòng phụ trách: ${sender.dept || 'Chưa cập nhật'}

Quy tắc bắt buộc về danh tính người gửi:
1. Viết thư thay mặt Ý Niệm Điện Ảnh nhưng phải nhận diện đúng người phụ trách ở trên.
2. Tuyệt đối không gọi hoặc ký tên người gửi là "Trưởng ban Nhân sự", "Trưởng HR", "Trưởng phòng Nhân sự" hay chức danh lãnh đạo nào khác, trừ khi chính trường Ban/phòng phụ trách ghi rõ chức danh đó.
3. Quyền Admin hoặc Ban Tổ Chức không đồng nghĩa với Trưởng ban Nhân sự.
4. Kết thư bằng đúng chữ ký: <p>Trân trọng,<br><strong>${sender.name}</strong><br>${position}<br>Ý Niệm Điện Ảnh</p>. Không tự tạo thêm chức danh.
5. Email tài khoản chỉ dùng để nhận diện ngữ cảnh; không đưa vào nội dung thư trừ khi yêu cầu riêng nói rõ.`;
}

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
}

function applyEmailSenderIdentity(email, sender) {
    const result = { ...email };
    const position = sender.dept || sender.role || 'Thành viên';
    let body = String(result.body || '').trim();

    // Không để chức danh do AI tự suy diễn lọt vào nội dung hoặc chữ ký.
    body = body.replace(/Trưởng\s*(?:ban|phòng)?\s*(?:Nhân\s*Sự|HR)/gi, 'người phụ trách');
    // Gỡ chữ ký cuối thư do AI tạo để thay bằng danh tính đã xác thực từ phiên đăng nhập.
    body = body.replace(/<p\b[^>]*>\s*(?:Trân trọng|Thân ái|Trân quý|Kính thư)[\s\S]*?<\/p>/gi, '').trim();

    const signature = '<p>Trân trọng,<br><strong>' + escapeHtml(sender.name) + '</strong><br>' +
        escapeHtml(position) + '<br>Ý Niệm Điện Ảnh</p>';
    result.body = body + signature;
    return result;
}

module.exports = { normalizeEmailSender, emailSenderPromptContext, applyEmailSenderIdentity };
