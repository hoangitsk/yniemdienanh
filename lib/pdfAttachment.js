'use strict';

const MAX_PDF_BYTES = 2 * 1024 * 1024;

function makeBadRequest(message) {
    return Object.assign(new Error(message), { status: 400 });
}

function normalizePdfAttachment(attachment) {
    if (!attachment) return undefined;
    if (typeof attachment !== 'object') throw makeBadRequest('Tệp đính kèm không hợp lệ.');

    const filename = String(attachment.filename || 'tai-lieu.pdf')
        .replace(/[\r\n]/g, '')
        .replace(/[\\/:*?"<>|]/g, '_')
        .slice(0, 150);
    const base64 = String(attachment.base64 || '').replace(/\s/g, '');

    if (!filename.toLowerCase().endsWith('.pdf')) {
        throw makeBadRequest('Chỉ chấp nhận tệp PDF.');
    }
    if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
        throw makeBadRequest('Dữ liệu tệp PDF không hợp lệ.');
    }

    const content = Buffer.from(base64, 'base64');
    if (!content.length || content.length > MAX_PDF_BYTES) {
        throw makeBadRequest('Tệp PDF phải nhỏ hơn hoặc bằng 2 MB.');
    }
    if (content.subarray(0, 5).toString('ascii') !== '%PDF-') {
        throw makeBadRequest('Tệp tải lên không phải PDF hợp lệ.');
    }

    return { filename, content, contentType: 'application/pdf' };
}

module.exports = { MAX_PDF_BYTES, normalizePdfAttachment };
