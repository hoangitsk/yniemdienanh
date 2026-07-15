(function () {
    'use strict';

    var EMAIL_LABELS = {
        approve: 'Duyệt & chào mừng',
        round1_pass: 'Vượt qua vòng 1',
        interview: 'Mời chọn lịch phỏng vấn',
        reject: 'Từ chối ứng tuyển',
        attachment_followup: 'Bổ sung tài liệu',
        custom: 'Thư tùy chỉnh'
    };

    function emailLabel(type) {
        return EMAIL_LABELS[type] || EMAIL_LABELS.custom;
    }

    function formatEmailTime(value) {
        if (!value) return '';
        var date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
        });
    }

    window.renderApplicationEmailStatus = function (app) {
        var history = Array.isArray(app.emailHistory) ? app.emailHistory : [];
        var last = history.length ? history[history.length - 1] : null;
        var type = (last && last.type) || app.lastEmailType;
        var sentAt = (last && last.sentAt) || app.lastEmailSentAt;
        if (!type) return '<span style="font-size:.76rem;color:var(--text-muted)">Chưa gửi email</span>';
        var count = history.length || 1;
        var recent = history.length ? history.slice(-3).reverse() : [{ type: type, sentAt: sentAt, subject: app.lastEmailSubject }];
        return recent.map(function (item) {
            return '<div style="margin-top:4px"><span class="chip" title="' + esc(item.subject || emailLabel(item.type)) + '" style="background:rgba(34,197,94,.13);color:var(--ok)">📨 ' +
                esc(emailLabel(item.type)) + '</span><div style="font-size:.68rem;color:var(--text-muted);margin-top:2px">' + esc(formatEmailTime(item.sentAt)) +
                (item.attachmentName ? ' · 📎 ' + esc(item.attachmentName) : '') + '</div></div>';
        }).join('') + (count > 3 ? '<div style="font-size:.68rem;color:var(--text-muted);margin-top:3px">+' + (count - 3) + ' thư trước</div>' : '');
    };

    window.updateBulkEmailCount = function () {
        var count = document.querySelectorAll('.bulk-email-app:checked').length;
        var output = document.getElementById('bulkEmailCount');
        if (output) output.textContent = count + ' ứng viên đã chọn';
    };

    window.toggleBulkEmailSelection = function (checked, origin) {
        var scope = origin && origin.closest ? origin.closest('table') : document;
        scope.querySelectorAll('.bulk-email-app').forEach(function (box) { box.checked = checked; });
        updateBulkEmailCount();
    };

    function selectedApplications() {
        var ids = Array.from(document.querySelectorAll('.bulk-email-app:checked')).map(function (box) { return String(box.value); });
        return (localDB.applications || []).filter(function (app) { return ids.indexOf(String(app.id)) !== -1; });
    }

    function fallbackEmail(app, type) {
        var name = esc(app.name || 'bạn');
        var dept = esc(app.dept || 'Ban Tổ Chức');
        var scheduleUrl = window.location.origin + '/schedule';
        var sender = typeof window.currentEmailSenderIdentity === 'function' ? window.currentEmailSenderIdentity() : {};
        var roleLabels = { admin: 'Quản trị viên', organizer: 'Ban Tổ Chức', member: 'Thành viên' };
        var senderName = esc(sender.name || 'Đội ngũ Ý Niệm Điện Ảnh');
        var senderPosition = esc(sender.dept || roleLabels[sender.role] || sender.role || 'Thành viên');
        var signature = '<p>Trân trọng,<br><strong>' + senderName + '</strong><br>' + senderPosition + '<br>Ý Niệm Điện Ảnh</p>';
        var templates = {
            approve: {
                subject: '[Ý Niệm Điện Ảnh] Kết quả ứng tuyển — ' + (app.name || ''),
                body: '<p>Xin chào <strong>' + name + '</strong>,</p><p>Ban Nhân Sự vui mừng thông báo hồ sơ ứng tuyển vào <strong>' + dept + '</strong> của bạn đã được thông qua.</p><p>Chúng tôi sẽ sớm liên hệ để hướng dẫn onboarding. Chào mừng bạn đến với Ý Niệm Điện Ảnh! ✨</p>' + signature
            },
            round1_pass: {
                subject: '[Ý Niệm Điện Ảnh] Chúc mừng bạn đã vượt qua vòng 1 — ' + (app.name || ''),
                body: '<p>Xin chào <strong>' + name + '</strong>,</p><p>Chúc mừng bạn đã chính thức <strong>vượt qua vòng 1</strong>.</p><p>Trong vòng <strong>3 ngày tới</strong>, Ban Nhân Sự sẽ gửi email tiếp theo để bạn lựa chọn lịch phỏng vấn phù hợp.</p>' + signature
            },
            interview: {
                subject: '[Ý Niệm Điện Ảnh] Mời chọn lịch phỏng vấn — ' + (app.name || ''),
                body: '<p>Xin chào <strong>' + name + '</strong>,</p><p>Chúng tôi trân trọng mời bạn tham gia vòng phỏng vấn.</p><p><a href="' + scheduleUrl + '" style="color:#b7791f;font-weight:700">Chọn các khung giờ bạn có thể tham gia tại đây</a>.</p><p>Hệ thống chốt lịch lúc 0h hằng ngày theo giờ Việt Nam. Nếu chưa được chốt, bạn vẫn có thể cập nhật lựa chọn đến hết hạn của đợt phỏng vấn.</p>' + signature
            },
            reject: {
                subject: '[Ý Niệm Điện Ảnh] Thư cảm ơn ứng tuyển — ' + (app.name || ''),
                body: '<p>Xin chào <strong>' + name + '</strong>,</p><p>Cảm ơn bạn đã dành thời gian ứng tuyển vào <strong>' + dept + '</strong>. Rất tiếc chúng tôi chưa thể đồng hành cùng bạn trong đợt này.</p><p>Chúc bạn luôn giữ vững đam mê và gặp nhiều may mắn.</p>' + signature
            },
            attachment_followup: {
                subject: '[Ý Niệm Điện Ảnh] Bổ sung tài liệu đính kèm',
                body: '<p>Xin chào <strong>' + name + '</strong>,</p><p>Ban Nhân Sự xin gửi bổ sung tài liệu còn thiếu trong email trước. Bạn vui lòng xem tệp đính kèm trong email này nhé.</p><p>Mong bạn thông cảm vì sự bất tiện.</p>' + signature
            }
        };
        return templates[type] || templates.approve;
    }

    async function recordSentEmail(app, details) {
        var entry = {
            id: 'email_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            type: details.type || 'custom',
            label: emailLabel(details.type),
            subject: details.subject,
            sentAt: new Date().toISOString(),
            sentBy: typeof session !== 'undefined' && session && session.id ? session.id : '',
            sentByName: typeof session !== 'undefined' && session && session.name ? session.name : '',
            sentByEmail: typeof session !== 'undefined' && session && session.email ? session.email : '',
            sentByRole: typeof session !== 'undefined' && session && session.role ? session.role : '',
            sentByDept: typeof session !== 'undefined' && session && session.dept ? session.dept : '',
            source: details.source || 'single',
            aiPersonalized: Boolean(details.aiPersonalized),
            attachmentName: details.attachmentName || ''
        };
        app.emailHistory = Array.isArray(app.emailHistory) ? app.emailHistory : [];
        app.emailHistory.push(entry);
        app.lastEmailType = entry.type;
        app.lastEmailLabel = entry.label;
        app.lastEmailSubject = entry.subject;
        app.lastEmailSentAt = entry.sentAt;
        await saveItem('applications', app);
    }

    async function sendEmail(payload) {
        var response = await fetch('/api/email/send-custom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        var data = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(data.error || 'Lỗi gửi email');
        return data;
    }

    window.sendCustomEmailSubmit = async function () {
        var app = window.currentEmailApp;
        var to = document.getElementById('emTo').value;
        var subject = document.getElementById('emSubject').value;
        var html = document.getElementById('emBody').value;
        var pdfFile = document.getElementById('emPdfAttachment').files[0];
        var type = document.getElementById('emTemplateSelect').value || 'custom';
        if (!subject.trim() || !html.trim()) return showToast('Vui lòng điền đầy đủ tiêu đề và nội dung email.', 'warning');
        if (pdfFile && (!pdfFile.name.toLowerCase().endsWith('.pdf') || pdfFile.size > 2 * 1024 * 1024)) {
            return showToast('Tài liệu đính kèm phải là PDF và không vượt quá 2 MB.', 'warning');
        }
        var btn = document.getElementById('emSendBtn');
        btn.disabled = true;
        btn.textContent = '⏳ Đang gửi...';
        try {
            var attachment;
            if (pdfFile) {
                var dataUrl = await new Promise(function (resolve, reject) {
                    var reader = new FileReader();
                    reader.onload = function () { resolve(reader.result); };
                    reader.onerror = function () { reject(new Error('Không thể đọc tệp PDF.')); };
                    reader.readAsDataURL(pdfFile);
                });
                attachment = { filename: pdfFile.name, base64: String(dataUrl).split(',')[1] };
            }
            await sendEmail({ to: to, subject: subject, html: html, attachment: attachment });
            try {
                if (app) await recordSentEmail(app, { type: type, subject: subject, source: 'single', aiPersonalized: Boolean(window.currentEmailWasAi), attachmentName: pdfFile ? pdfFile.name : '' });
                showToast('Gửi email thành công và đã lưu lịch sử!', 'success');
            } catch (historyError) {
                console.error(historyError);
                showToast('Email đã gửi, nhưng chưa lưu được lịch sử. Không cần gửi lại.', 'warning');
            }
            closeModal('emailModal');
            if (typeof renderTab === 'function') renderTab('members');
        } catch (error) {
            console.error(error);
            showToast('Gửi email thất bại: ' + error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = '📤 Gửi Email';
        }
    };

    var originalOpenEmailModal = window.openEmailModal;
    window.openEmailModal = function (appId) {
        window.currentEmailWasAi = false;
        return originalOpenEmailModal(appId);
    };

    var originalGenerateEmailWithAI = window.generateEmailWithAI;
    window.generateEmailWithAI = async function () {
        var before = document.getElementById('emBody').value;
        await originalGenerateEmailWithAI();
        window.currentEmailWasAi = document.getElementById('emBody').value !== before;
    };

    async function generateBulkContent(apps, type, customDescription) {
        var response = await fetch('/api/email/generate-gemini-bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emailType: type, customDescription: customDescription, sender: typeof window.currentEmailSenderIdentity === 'function' ? window.currentEmailSenderIdentity() : {}, applications: apps.map(function (app) {
                return { id: app.id, type: app.type, name: app.name, dept: app.dept, intro: app.intro, vision: app.vision };
            }) })
        });
        var data = await response.json().catch(function () { return {}; });
        if (!response.ok || !Array.isArray(data.emails)) throw new Error(data.error || 'Gemini không tạo được lô email');
        return data.emails;
    }

    window.sendBulkPersonalizedEmails = async function () {
        var apps = selectedApplications();
        var typeInput = document.getElementById('bulkEmailType');
        var attachmentInput = document.getElementById('bulkEmailAttachment');
        var attachmentFile = attachmentInput && attachmentInput.files ? attachmentInput.files[0] : null;
        var descriptionInput = document.getElementById('bulkEmailDescription');
        var customDescription = descriptionInput ? descriptionInput.value.trim() : '';
        var type = typeInput ? typeInput.value : '';
        var button = document.getElementById('bulkEmailSendBtn');
        var progress = document.getElementById('bulkEmailProgress');
        if (!apps.length) return showToast('Hãy chọn ít nhất một ứng viên.', 'warning');
        if (!type) return showToast('Hãy chọn loại email muốn gửi.', 'warning');
        if (type === 'custom' && !customDescription) return showToast('Hãy nhập mô tả nội dung để Gemini soạn thư tùy chỉnh.', 'warning');
        if (type === 'attachment_followup' && !attachmentFile) return showToast('Thư bổ sung tài liệu cần chọn một file PDF.', 'warning');
        if (attachmentFile && (!attachmentFile.name.toLowerCase().endsWith('.pdf') || attachmentFile.size > 2 * 1024 * 1024)) {
            return showToast('Tệp gửi hàng loạt phải là PDF và không vượt quá 2 MB.', 'warning');
        }
        var duplicateCount = apps.filter(function (app) { return app.lastEmailType === type; }).length;
        var message = 'Gửi ' + emailLabel(type) + ' cho ' + apps.length + ' ứng viên? Nội dung sẽ được cá nhân hóa riêng.';
        if (duplicateCount) message += '\n\nCó ' + duplicateCount + ' ứng viên đã từng nhận loại thư này.';
        if (!window.confirm(message)) return;

        button.disabled = true;
        var contents = {};
        var aiIds = {};
        var failures = [];
        try {
            var attachment;
            if (attachmentFile) {
                if (progress) progress.textContent = 'Đang đọc file đính kèm...';
                var dataUrl = await new Promise(function (resolve, reject) {
                    var reader = new FileReader();
                    reader.onload = function () { resolve(reader.result); };
                    reader.onerror = function () { reject(new Error('Không thể đọc file PDF.')); };
                    reader.readAsDataURL(attachmentFile);
                });
                attachment = { filename: attachmentFile.name, base64: String(dataUrl).split(',')[1] };
            }

            if (type === 'attachment_followup' && !customDescription) {
                apps.forEach(function (app) { contents[String(app.id)] = fallbackEmail(app, type); });
            } else {
                for (var offset = 0; offset < apps.length; offset += 8) {
                    var chunk = apps.slice(offset, offset + 8);
                    if (progress) progress.textContent = 'Gemini đang viết riêng thư ' + (offset + 1) + '–' + Math.min(offset + chunk.length, apps.length) + '/' + apps.length + '...';
                    try {
                        var generated = await generateBulkContent(chunk, type, customDescription);
                        generated.forEach(function (email) { contents[String(email.id)] = email; aiIds[String(email.id)] = true; });
                    } catch (error) {
                        console.warn('Bulk Gemini fallback:', error);
                        if (type === 'custom') throw new Error('Gemini chưa tạo được thư tùy chỉnh nên hệ thống đã dừng trước khi gửi. ' + error.message);
                        chunk.forEach(function (app) { contents[String(app.id)] = fallbackEmail(app, type); });
                    }
                }
            }

            for (var i = 0; i < apps.length; i += 1) {
                var app = apps[i];
                var content = contents[String(app.id)] || fallbackEmail(app, type);
                if (progress) progress.textContent = 'Đang gửi ' + (i + 1) + '/' + apps.length + ': ' + app.name;
                button.textContent = '⏳ ' + (i + 1) + '/' + apps.length;
                try {
                    await sendEmail({ to: app.email, subject: content.subject, html: content.body, attachment: attachment });
                    try {
                        await recordSentEmail(app, { type: type, subject: content.subject, source: 'bulk', aiPersonalized: Boolean(aiIds[String(app.id)]), attachmentName: attachmentFile ? attachmentFile.name : '' });
                    } catch (historyError) {
                        failures.push(app.name + ' (đã gửi, lỗi lưu lịch sử)');
                    }
                } catch (sendError) {
                    failures.push(app.name + ' (' + sendError.message + ')');
                }
            }
            var sent = apps.length - failures.length;
            if (failures.length) {
                showToast('Hoàn tất: ' + sent + '/' + apps.length + ' email. Kiểm tra danh sách lỗi bên dưới.', 'warning');
                if (progress) progress.textContent = 'Lỗi: ' + failures.join('; ');
            } else {
                showToast('Đã gửi và lưu lịch sử cho ' + sent + ' ứng viên!', 'success');
                if (progress) progress.textContent = 'Hoàn tất ' + sent + '/' + apps.length + ' email.';
                if (attachmentInput) attachmentInput.value = '';
            }
            renderTab('members');
        } catch (error) {
            console.error(error);
            showToast(error.message || 'Không thể chuẩn bị email hàng loạt.', 'error');
            if (progress) progress.textContent = 'Đã dừng trước khi gửi: ' + (error.message || 'Lỗi không xác định');
        } finally {
            button.disabled = false;
            button.textContent = '📤 Gửi cá nhân hóa hàng loạt';
        }
    };
})();
