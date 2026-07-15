'use strict';

const nodemailer = require('nodemailer');

function clean(value) {
    return String(value || '').trim();
}

function errorLabel(error) {
    const parts = [];
    if (error && error.code) parts.push(String(error.code));
    if (error && error.responseCode) parts.push('SMTP ' + error.responseCode);
    if (error && error.message) parts.push(String(error.message));
    return parts.join(' · ') || 'Lỗi gửi email không xác định';
}

function brevoSettings() {
    const user = clean(process.env.BREVO_SMTP_LOGIN);
    const pass = clean(process.env.BREVO_SMTP_KEY);
    const email = clean(process.env.BREVO_FROM_EMAIL);
    if (!user || !pass || !email) return null;
    return {
        provider:'brevo',
        email,
        transport:{
            host:'smtp-relay.brevo.com',
            port:587,
            secure:false,
            connectionTimeout:5000,
            greetingTimeout:5000,
            socketTimeout:8000,
            auth:{ user, pass }
        }
    };
}

function gmailSettings() {
    const user = clean(process.env.GMAIL_USER);
    const pass = clean(process.env.GMAIL_APP_PASS).replace(/\s+/g, '');
    if (!user || !pass) return null;
    return {
        provider:'gmail',
        email:user,
        transport:{
            service:'gmail',
            connectionTimeout:5000,
            greetingTimeout:5000,
            socketTimeout:8000,
            auth:{ user, pass }
        }
    };
}

function availableSettings() {
    return [brevoSettings(), gmailSettings()].filter(Boolean);
}

function preferredSender() {
    const settings = availableSettings()[0];
    return settings ? {
        email:settings.email,
        name:clean(process.env.BREVO_FROM_NAME) || 'Ý Niệm Điện Ảnh'
    } : null;
}

async function sendMailWithFallback(message, options) {
    const settings = availableSettings();
    if (!settings.length) {
        throw new Error('Chưa cấu hình Brevo SMTP hoặc Gmail App Password trên máy chủ.');
    }
    const fromName = clean(options && options.fromName) || clean(process.env.BREVO_FROM_NAME) || 'Ý Niệm Điện Ảnh';
    const failures = [];
    for (const setting of settings) {
        try {
            const transporter = nodemailer.createTransport(setting.transport);
            const info = await transporter.sendMail(Object.assign({}, message, {
                from:'"' + fromName.replace(/["\r\n]/g, '') + '" <' + setting.email + '>'
            }));
            if (failures.length) console.warn('Email đã chuyển sang kênh dự phòng:', setting.provider, failures.join(' | '));
            return { provider:setting.provider, messageId:info && info.messageId || '' };
        } catch (error) {
            failures.push(setting.provider + ': ' + errorLabel(error));
        }
    }
    throw new Error('Không kênh email nào gửi được. ' + failures.join(' | '));
}

module.exports = { preferredSender, sendMailWithFallback };
