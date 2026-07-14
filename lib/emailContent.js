'use strict';

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({
        '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    })[char]);
}

function safeScheduleUrl(value) {
    try {
        const url = new URL(String(value || ''));
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid protocol');
        return url.toString();
    } catch (_) {
        return 'https://yniemdienanh.vercel.app/schedule';
    }
}

function ensureInterviewScheduleContent(data, emailType, configuredUrl) {
    if (emailType !== 'interview') return data;
    const result = data && typeof data === 'object' ? { ...data } : {};
    const scheduleUrl = safeScheduleUrl(configuredUrl);
    const body = String(result.body || '');
    const hasScheduleLink = body.includes(scheduleUrl) || /href=["'][^"']*\/schedule(?:[?#][^"']*)?["']/i.test(body);
    const hasMidnightNotice = /(?:\b0h\b|00:00).{0,100}(?:Việt Nam|Vietnam)/i.test(body);
    let addition = '';

    if (!hasScheduleLink) {
        addition += `<p style="margin:20px 0;text-align:center"><a href="${escapeHtml(scheduleUrl)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#e4b866;color:#111827;text-decoration:none;font-weight:700">Chọn thời gian rảnh phỏng vấn</a></p>`;
    }
    if (!hasMidnightNotice) {
        addition += '<p><strong>Lưu ý về lịch:</strong> Hệ thống chốt lịch vào 0h hằng ngày theo giờ Việt Nam. Nếu chưa được chốt, bạn vẫn có thể cập nhật phiếu đến hết thời hạn của đợt phỏng vấn.</p>';
    }

    result.body = body + addition;
    return result;
}

module.exports = { ensureInterviewScheduleContent };
