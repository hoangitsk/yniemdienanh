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

function markdownInlineToHtml(value) {
    const links = [];
    let text = String(value || '').replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi, (_, label, url) => {
        const index = links.push({ label, url }) - 1;
        return `\u0000LINK${index}\u0000`;
    });
    text = escapeHtml(text)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/__([^_]+)__/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return text.replace(/\u0000LINK(\d+)\u0000/g, (_, rawIndex) => {
        const link = links[Number(rawIndex)];
        if (!link) return '';
        const label = escapeHtml(link.label)
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/__([^_]+)__/g, '<strong>$1</strong>');
        return `<a href="${escapeHtml(link.url)}">${label}</a>`;
    });
}

function markdownToEmailHtml(value) {
    let body = String(value || '').trim()
        .replace(/^```(?:html|markdown)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
    if (!body) return '';

    // Gemini đôi lúc trả Markdown dù prompt yêu cầu HTML. Nếu đã có thẻ HTML
    // thì giữ nguyên; nếu chưa có, chuyển Markdown/plain text thành HTML email.
    if (/<\/?(?:p|div|br|strong|b|em|i|ul|ol|li|a|h[1-6]|blockquote|table|tr|td)\b[^>]*>/i.test(body)) {
        return body;
    }

    return body.split(/\n\s*\n+/).map(block => {
        const lines = block.split(/\n/).map(line => line.trim()).filter(Boolean);
        if (!lines.length) return '';
        if (lines.every(line => /^[-*]\s+/.test(line))) {
            return '<ul>' + lines.map(line => '<li>' + markdownInlineToHtml(line.replace(/^[-*]\s+/, '')) + '</li>').join('') + '</ul>';
        }
        return '<p>' + lines.map(markdownInlineToHtml).join('<br>') + '</p>';
    }).join('');
}

function normalizeEmailContent(data) {
    const result = data && typeof data === 'object' ? { ...data } : {};
    result.subject = String(result.subject || '').replace(/\*\*([^*]+)\*\*/g, '$1').trim();
    result.body = markdownToEmailHtml(result.body);
    return result;
}

function ensureInterviewScheduleContent(data, emailType, configuredUrl) {
    const result = normalizeEmailContent(data);
    if (emailType !== 'interview') return result;
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

module.exports = { ensureInterviewScheduleContent, markdownToEmailHtml, normalizeEmailContent };
