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

    function renderEmailHistoryItem(item) {
        return '<div style="margin-top:4px"><span class="chip" title="' + esc(item.subject || emailLabel(item.type)) + '" style="background:rgba(34,197,94,.13);color:var(--ok)">📨 ' +
            esc(emailLabel(item.type)) + '</span><div style="font-size:.68rem;color:var(--text-muted);margin-top:2px">' + esc(formatEmailTime(item.sentAt)) +
            (item.attachmentName ? ' · 📎 ' + esc(item.attachmentName) : '') + '</div></div>';
    }

    window.toggleApplicationEmailHistory = function (button) {
        var history = button && button.nextElementSibling;
        if (!history) return;
        var opening = history.style.display === 'none';
        history.style.display = opening ? 'block' : 'none';
        button.setAttribute('aria-expanded', opening ? 'true' : 'false');
        button.textContent = opening ? 'Ẩn lịch sử' : '🕘 Lịch sử (' + (button.dataset.count || '0') + ')';
    };

    window.renderApplicationEmailStatus = function (app) {
        var history = Array.isArray(app.emailHistory) ? app.emailHistory : [];
        var sortedHistory = history.slice().sort(function (a, b) {
            var aTime = new Date(a && a.sentAt || 0).getTime() || 0;
            var bTime = new Date(b && b.sentAt || 0).getTime() || 0;
            return bTime - aTime;
        });
        var last = sortedHistory.length ? sortedHistory[0] : null;
        var type = (last && last.type) || app.lastEmailType;
        var sentAt = (last && last.sentAt) || app.lastEmailSentAt;
        if (!type) return '<span style="font-size:.76rem;color:var(--text-muted)">Chưa gửi email</span>';
        var latest = last || { type: type, sentAt: sentAt, subject: app.lastEmailSubject };
        var older = sortedHistory.length > 1 ? sortedHistory.slice(1) : [];
        var output = renderEmailHistoryItem(latest);
        if (older.length) {
            output += '<button type="button" class="btn btn-line btn-sm" data-count="' + older.length + '" aria-expanded="false" onclick="toggleApplicationEmailHistory(this)" style="width:auto;margin-top:6px;padding:3px 8px;font-size:.68rem;color:var(--text-muted);border-color:rgba(148,163,184,.28)">🕘 Lịch sử (' + older.length + ')</button>' +
                '<div class="application-email-history" style="display:none;margin-top:5px;padding-top:3px;border-top:1px solid rgba(148,163,184,.16)">' + older.map(renderEmailHistoryItem).join('') + '</div>';
        }
        return output;
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

    window.filterApplicationsForBulkSelect = function (roleFilter, statusFilter) {
        var checkboxes = document.querySelectorAll('.bulk-email-app');
        var count = 0;
        checkboxes.forEach(function (box) {
            var appId = String(box.value);
            var app = (localDB.applications || []).find(function (x) { return String(x.id) === appId; });
            if (!app) return;

            var isCore = (app.type === 'organizer' || app.type === 'cofounder' || app.type === 'president' || app.position === 'core' || app.position === 'vice_lead');
            var isMember = (app.type === 'member' || app.position === 'member');
            var isRejected = (app.status === 'rejected' || String(app.recruitmentStage || '').includes('failed') || String(app.interviewStatus || '').includes('không qua'));

            var matchesRole = true;
            if (roleFilter === 'core') matchesRole = isCore;
            else if (roleFilter === 'member') matchesRole = isMember;

            var matchesStatus = true;
            if (statusFilter === 'qualified') matchesStatus = !isRejected;
            else if (statusFilter === 'approved') matchesStatus = (app.status === 'approved');
            else if (statusFilter === 'pending') matchesStatus = (app.status === 'pending');

            box.checked = (matchesRole && matchesStatus);
            if (box.checked) count++;
        });
        updateBulkEmailCount();
        if (typeof showToast === 'function') showToast('Đã chọn ' + count + ' ứng viên phù hợp với bộ lọc.', 'info');
    };

    function selectedApplications() {
        var ids = Array.from(document.querySelectorAll('.bulk-email-app:checked')).map(function (box) { return String(box.value); });
        return (localDB.applications || []).filter(function (app) { return ids.indexOf(String(app.id)) !== -1; });
    }

    function fallbackEmail(app, type, selectedScheduleCode) {
        var name = esc(app.name || 'bạn');
        var dept = esc(app.dept || 'Ban Tổ Chức');
        var scheduleCode = selectedScheduleCode || app.activeScheduleCode || app.nextScheduleCode || app.interviewPollCode || app.meetingPollCode || '';
        var scheduleUrl = window.location.origin + (scheduleCode ? '/schedule/' + encodeURIComponent(scheduleCode) : '/schedule');
        var sender = typeof window.currentEmailSenderIdentity === 'function' ? window.currentEmailSenderIdentity() : {};
        var roleLabels = { admin: 'Quản trị viên', organizer: 'Ban Tổ Chức', member: 'Thành viên' };
        var senderName = esc(sender.name || 'Đội ngũ Ý Niệm Điện Ảnh');
        var senderPosition = esc(sender.dept || roleLabels[sender.role] || sender.role || 'Thành viên');
        var signature = '<p>Trân trọng,<br><strong>' + senderName + '</strong><br>' + senderPosition + '<br>Ý Niệm Điện Ảnh</p>';
        function getDepartmentGroupLink(deptName) {
            var d = String(deptName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (d.includes('noi dung') || d.includes('duyet bai')) {
                return {
                    name: 'Ban Nội dung & Duyệt bài',
                    url: 'https://m.me/j/AbYWXdZyqbheibXd/?send_source=gc%3Acopy_invite_link_c'
                };
            }
            if (d.includes('media') || d.includes('truyen thong') || d.includes('pr') || d.includes('mkt') || d.includes('marketing') || d.includes('design') || d.includes('edit')) {
                return {
                    name: 'Ban Media & Truyền thông',
                    url: 'https://m.me/j/AbbV1CGoOXkaGF0t/?send_source=gc%3Acopy_invite_link_c'
                };
            }
            return null;
        }

        var grp = getDepartmentGroupLink(dept);
        var groupInviteHtml = '';
        if (grp) {
            groupInviteHtml = '<p style="margin:16px 0"><a href="' + grp.url + '" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#e4b866;color:#111827;text-decoration:none;font-weight:700" target="_blank">👉 Tham gia nhóm Messenger ' + grp.name + '</a></p>';
        } else {
            groupInviteHtml = '<p style="margin:16px 0">' +
                '<a href="https://m.me/j/AbYWXdZyqbheibXd/?send_source=gc%3Acopy_invite_link_c" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#e4b866;color:#111827;text-decoration:none;font-weight:700;margin-right:8px" target="_blank">Nhóm Nội dung & Duyệt bài</a> ' +
                '<a href="https://m.me/j/AbbV1CGoOXkaGF0t/?send_source=gc%3Acopy_invite_link_c" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#e4b866;color:#111827;text-decoration:none;font-weight:700" target="_blank">Nhóm Media & Truyền thông</a></p>';
        }
        groupInviteHtml += '<p style="margin-top:12px;font-size:0.88rem;color:#cbd5e1">💡 <em>Lưu ý: Nếu không tham gia bằng đường link Messenger trên được, bạn vui lòng kết bạn Facebook với Trưởng Ban tại <a href="https://www.facebook.com/Harlanitskt" style="color:#e4b866;font-weight:700" target="_blank">Facebook Harlanitskt</a> để được hỗ trợ thêm vào nhóm nhé!</em></p>';

        var templates = {
            approve: {
                subject: '[Ý Niệm Điện Ảnh] Kết quả ứng tuyển — ' + (app.name || ''),
                body: '<p>Xin chào <strong>' + name + '</strong>,</p><p>Ban Nhân Sự vui mừng thông báo hồ sơ ứng tuyển vào <strong>' + dept + '</strong> của bạn đã được chính thức thông qua.</p>' + groupInviteHtml + '<p>Chào mừng bạn đến với đại gia đình Ý Niệm Điện Ảnh! ✨</p>' + signature
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
        if (window.firebase && firebase.auth && firebase.auth().currentUser) {
            payload = Object.assign({}, payload, { idToken: await firebase.auth().currentUser.getIdToken() });
        }
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
            if (app && typeof window.assignApplicationToSelectedSchedule === 'function') {
                await window.assignApplicationToSelectedSchedule(app, type);
                if (typeof window.updateEmailScheduleLink === 'function') {
                    window.updateEmailScheduleLink(app.activeScheduleCode || '');
                }
                subject = document.getElementById('emSubject').value;
                html = document.getElementById('emBody').value;
            }
            var sCode = (app && (app.activeScheduleCode || app.nextScheduleCode || app.interviewPollCode || app.meetingPollCode)) || '';
            var sUrl = window.location.origin + (sCode ? '/schedule/' + encodeURIComponent(sCode) : '/schedule');
            if (type === 'interview' || sCode) {
                if (!html.includes(sUrl) && !/href=["'][^"']*\/(?:schedule|select-time)/i.test(html)) {
                    html += '<p style="margin:20px 0;text-align:center"><a href="' + sUrl + '" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#e4b866;color:#111827;text-decoration:none;font-weight:700">Chọn thời gian rảnh phỏng vấn</a></p>';
                }
            }
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

    async function currentIdToken() {
        return window.firebase && firebase.auth && firebase.auth().currentUser
            ? firebase.auth().currentUser.getIdToken()
            : '';
    }

    async function generateBulkContent(apps, type, customDescription, scheduleCode) {
        var idToken = window.firebase && firebase.auth && firebase.auth().currentUser
            ? await firebase.auth().currentUser.getIdToken()
            : '';
        var response = await fetch('/api/email/generate-gemini-bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: idToken, emailType: type, customDescription: customDescription, sender: typeof window.currentEmailSenderIdentity === 'function' ? window.currentEmailSenderIdentity() : {}, applications: apps.map(function (app) {
                return { id: app.id, type: app.type, name: app.name, dept: app.dept, intro: app.intro, vision: app.vision, scheduleCode: scheduleCode || app.activeScheduleCode || app.nextScheduleCode || app.interviewPollCode || app.meetingPollCode || '' };
            }) })
        });
        var data = await response.json().catch(function () { return {}; });
        if (!response.ok || !Array.isArray(data.emails)) throw new Error(data.error || 'Gemini không tạo được lô email');
        return data.emails;
    }

    async function loadBulkScheduleOptions() {
        var select = document.getElementById('bulkEmailScheduleCode');
        var progress = document.getElementById('bulkEmailProgress');
        if (!select || select.dataset.loaded === 'true') return;
        select.disabled = true;
        if (progress) progress.textContent = 'Đang tải các đợt vote lịch phỏng vấn được cấp quyền...';
        try {
            var response = await fetch('/api/schedule/list-availability', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken: await currentIdToken() })
            });
            var result = await response.json().catch(function () { return {}; });
            if (!response.ok || !Array.isArray(result.polls)) throw new Error(result.error || 'Không tải được đợt vote');
            var polls = result.polls.filter(function (poll) {
                return poll && poll.status === 'open' && poll.type === 'interview' && poll.code;
            });
            select.innerHTML = '<option value="">-- Chọn lịch vote phỏng vấn --</option>' + polls.map(function (poll) {
                return '<option value="' + esc(poll.code) + '">' + esc(poll.title || poll.code) + ' · ' + esc(poll.code) + '</option>';
            }).join('');
            select.dataset.loaded = 'true';
            if (progress) progress.textContent = polls.length
                ? 'Đã tải ' + polls.length + ' đợt vote. Lịch đã chọn sẽ được cấp riêng cho từng ứng viên trước khi gửi.'
                : 'Chưa có đợt vote phỏng vấn nào đang mở.';
        } catch (error) {
            if (progress) progress.textContent = 'Không tải được lịch phỏng vấn: ' + error.message;
            showToast('Không tải được lịch phỏng vấn: ' + error.message, 'error');
        } finally {
            select.disabled = false;
        }
    }

    window.handleBulkEmailTypeChange = function () {
        var type = document.getElementById('bulkEmailType');
        var schedule = document.getElementById('bulkEmailScheduleCode');
        if (!type || !schedule) return;
        var isInterview = type.value === 'interview';
        schedule.classList.toggle('hidden', !isInterview);
        if (isInterview) loadBulkScheduleOptions();
    };

    function renderBulkPreview() {
        var draft = window.bulkEmailDraft;
        if (!draft || !draft.apps.length) return;
        var select = document.getElementById('bulkPreviewRecipient');
        var summary = document.getElementById('bulkPreviewSummary');
        select.innerHTML = draft.apps.map(function (app, index) {
            return '<option value="' + esc(String(app.id)) + '">' + (index + 1) + '/' + draft.apps.length + ' · ' + esc(app.name) + ' · ' + esc(app.email) + '</option>';
        }).join('');
        select.value = draft.currentId || String(draft.apps[0].id);
        if (!select.value) select.selectedIndex = 0;
        draft.currentId = select.value;
        var aiCount = Object.keys(draft.aiIds).length;
        summary.textContent = emailLabel(draft.type) + ' · ' + draft.apps.length + ' người nhận · ' + aiCount + ' thư do Gemini cá nhân hóa' +
            (draft.attachmentFile ? ' · PDF: ' + draft.attachmentFile.name : '') +
            (draft.scheduleCode ? ' · Lịch: ' + draft.scheduleCode : '');
        window.switchBulkEmailPreview(draft.currentId);
    }

    window.saveCurrentBulkEmailDraft = function () {
        var draft = window.bulkEmailDraft;
        if (!draft || !draft.currentId) return;
        var content = draft.contents[String(draft.currentId)];
        if (!content) return;
        content.subject = document.getElementById('bulkPreviewSubject').value;
        content.body = document.getElementById('bulkPreviewBody').value;
    };

    window.switchBulkEmailPreview = function (id) {
        var draft = window.bulkEmailDraft;
        if (!draft) return;
        draft.currentId = String(id || '');
        var content = draft.contents[draft.currentId] || { subject: '', body: '' };
        document.getElementById('bulkPreviewRecipient').value = draft.currentId;
        document.getElementById('bulkPreviewSubject').value = content.subject || '';
        document.getElementById('bulkPreviewBody').value = content.body || '';
    };

    window.moveBulkEmailPreview = function (direction) {
        var draft = window.bulkEmailDraft;
        if (!draft || !draft.apps.length) return;
        window.saveCurrentBulkEmailDraft();
        var currentIndex = draft.apps.findIndex(function (app) { return String(app.id) === String(draft.currentId); });
        var nextIndex = Math.max(0, Math.min(draft.apps.length - 1, currentIndex + direction));
        window.switchBulkEmailPreview(String(draft.apps[nextIndex].id));
    };

    async function assignBulkApplicationToSchedule(app, pollCode, idToken) {
        var response = await fetch('/api/schedule/assign-participant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                idToken: idToken,
                pollCode: pollCode,
                expectedType: 'interview',
                applicationId: app.id,
                candidateEmail: app.email,
                candidateName: app.name
            })
        });
        var result = await response.json().catch(function () { return {}; });
        if (!response.ok || !result.success) throw new Error(result.error || 'Không thể cấp lịch cho ứng viên.');
        app.activeScheduleCode = pollCode;
        app.interviewPollCode = pollCode;
        app.recruitmentStage = 'interview_vote';
        if (result.user && result.user.id) app.approvedUserId = result.user.id;
        await saveItem('applications', app);
    }

    window.sendBulkPersonalizedEmails = async function () {
        var apps = selectedApplications();
        var typeInput = document.getElementById('bulkEmailType');
        var attachmentInput = document.getElementById('bulkEmailAttachment');
        var attachmentFile = attachmentInput && attachmentInput.files ? attachmentInput.files[0] : null;
        var descriptionInput = document.getElementById('bulkEmailDescription');
        var customDescription = descriptionInput ? descriptionInput.value.trim() : '';
        var type = typeInput ? typeInput.value : '';
        var scheduleInput = document.getElementById('bulkEmailScheduleCode');
        var scheduleCode = type === 'interview' ? String(scheduleInput && scheduleInput.value || '').trim().toUpperCase() : '';
        var button = document.getElementById('bulkEmailSendBtn');
        var progress = document.getElementById('bulkEmailProgress');
        if (!apps.length) return showToast('Hãy chọn ít nhất một ứng viên.', 'warning');
        if (!type) return showToast('Hãy chọn loại email muốn gửi.', 'warning');
        if (type === 'interview' && !scheduleCode) return showToast('Hãy chọn một đợt vote lịch phỏng vấn.', 'warning');
        if (type === 'custom' && !customDescription) return showToast('Hãy nhập mô tả nội dung để Gemini soạn thư tùy chỉnh.', 'warning');
        if (type === 'attachment_followup' && !attachmentFile) return showToast('Thư bổ sung tài liệu cần chọn một file PDF.', 'warning');
        if (attachmentFile && (!attachmentFile.name.toLowerCase().endsWith('.pdf') || attachmentFile.size > 2 * 1024 * 1024)) {
            return showToast('Tệp gửi hàng loạt phải là PDF và không vượt quá 2 MB.', 'warning');
        }
        button.disabled = true;
        button.textContent = '⏳ Đang soạn...';
        var contents = {};
        var aiIds = {};
        try {
            if (type === 'attachment_followup' && !customDescription) {
                apps.forEach(function (app) { contents[String(app.id)] = fallbackEmail(app, type, scheduleCode); });
            } else {
                for (var offset = 0; offset < apps.length; offset += 8) {
                    var chunk = apps.slice(offset, offset + 8);
                    if (progress) progress.textContent = 'Gemini đang viết riêng thư ' + (offset + 1) + '–' + Math.min(offset + chunk.length, apps.length) + '/' + apps.length + '...';
                    try {
                        var generated = await generateBulkContent(chunk, type, customDescription, scheduleCode);
                        generated.forEach(function (email) { contents[String(email.id)] = email; aiIds[String(email.id)] = true; });
                    } catch (error) {
                        console.warn('Bulk Gemini fallback:', error);
                        if (type === 'custom') throw new Error('Gemini chưa tạo được thư tùy chỉnh nên hệ thống đã dừng trước khi gửi. ' + error.message);
                        chunk.forEach(function (app) { contents[String(app.id)] = fallbackEmail(app, type, scheduleCode); });
                    }
                }
            }
            apps.forEach(function (app) {
                if (!contents[String(app.id)]) contents[String(app.id)] = fallbackEmail(app, type, scheduleCode);
            });
            window.bulkEmailDraft = {
                apps: apps,
                type: type,
                customDescription: customDescription,
                scheduleCode: scheduleCode,
                attachmentFile: attachmentFile,
                contents: contents,
                aiIds: aiIds,
                currentId: String(apps[0].id)
            };
            renderBulkPreview();
            document.getElementById('bulkPreviewProgress').textContent = 'Hãy kiểm tra tiêu đề và nội dung của từng người nhận trước khi gửi.';
            openModal('bulkEmailPreviewModal');
            if (progress) progress.textContent = 'Đã soạn xong ' + apps.length + ' thư. Bạn có thể xem và chỉnh riêng từng thư.';
        } catch (error) {
            console.error(error);
            showToast(error.message || 'Không thể chuẩn bị email hàng loạt.', 'error');
            if (progress) progress.textContent = 'Đã dừng trước khi gửi: ' + (error.message || 'Lỗi không xác định');
        } finally {
            button.disabled = false;
            button.textContent = '🤖 Soạn & xem trước tất cả';
        }
    };

    window.sendPreparedBulkEmails = async function () {
        var draft = window.bulkEmailDraft;
        if (!draft || !draft.apps || !draft.apps.length) return showToast('Bản nháp hàng loạt không còn tồn tại. Hãy soạn lại.', 'warning');
        window.saveCurrentBulkEmailDraft();
        var incomplete = draft.apps.filter(function (app) {
            var content = draft.contents[String(app.id)] || {};
            return !String(content.subject || '').trim() || !String(content.body || '').trim();
        });
        if (incomplete.length) return showToast('Còn ' + incomplete.length + ' thư thiếu tiêu đề hoặc nội dung.', 'warning');

        var duplicateCount = draft.apps.filter(function (app) { return app.lastEmailType === draft.type; }).length;
        var message = 'Gửi ' + emailLabel(draft.type) + ' cho ' + draft.apps.length + ' ứng viên?';
        if (draft.scheduleCode) message += '\nLịch phỏng vấn: ' + draft.scheduleCode + '.';
        if (duplicateCount) message += '\n\nCó ' + duplicateCount + ' ứng viên đã từng nhận loại thư này.';
        if (!window.confirm(message)) return;

        var button = document.getElementById('bulkPreviewSendBtn');
        var progress = document.getElementById('bulkPreviewProgress');
        button.disabled = true;
        var attachment;
        var sent = 0;
        var sendFailures = [];
        var failedApps = [];
        var historyWarnings = [];
        try {
            if (draft.attachmentFile) {
                progress.textContent = 'Đang đọc file PDF đính kèm...';
                var dataUrl = await new Promise(function (resolve, reject) {
                    var reader = new FileReader();
                    reader.onload = function () { resolve(reader.result); };
                    reader.onerror = function () { reject(new Error('Không thể đọc file PDF.')); };
                    reader.readAsDataURL(draft.attachmentFile);
                });
                attachment = { filename: draft.attachmentFile.name, base64: String(dataUrl).split(',')[1] };
            }
            var idToken = await currentIdToken();
            for (var i = 0; i < draft.apps.length; i += 1) {
                var app = draft.apps[i];
                var content = draft.contents[String(app.id)] || {};
                var emailBody = String(content.body || '');
                var bulkSCode = draft.scheduleCode || app.activeScheduleCode || app.nextScheduleCode || app.interviewPollCode || app.meetingPollCode || '';
                var bulkSUrl = window.location.origin + (bulkSCode ? '/schedule/' + encodeURIComponent(bulkSCode) : '/schedule');
                if (draft.type === 'interview' || bulkSCode) {
                    if (!emailBody.includes(bulkSUrl) && !/href=["'][^"']*\/(?:schedule|select-time)/i.test(emailBody)) {
                        emailBody += '<p style="margin:20px 0;text-align:center"><a href="' + bulkSUrl + '" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#e4b866;color:#111827;text-decoration:none;font-weight:700">Chọn thời gian rảnh phỏng vấn</a></p>';
                    }
                }
                progress.textContent = 'Đang xử lý ' + (i + 1) + '/' + draft.apps.length + ': ' + app.name;
                button.textContent = '⏳ ' + (i + 1) + '/' + draft.apps.length;
                try {
                    if (draft.type === 'interview') {
                        await assignBulkApplicationToSchedule(app, draft.scheduleCode, idToken);
                    }
                    await sendEmail({ to: app.email, subject: content.subject, html: emailBody, attachment: attachment });
                    sent += 1;
                    try {
                        await recordSentEmail(app, {
                            type: draft.type,
                            subject: content.subject,
                            source: 'bulk',
                            aiPersonalized: Boolean(draft.aiIds[String(app.id)]),
                            attachmentName: draft.attachmentFile ? draft.attachmentFile.name : ''
                        });
                    } catch (historyError) {
                        historyWarnings.push(app.name);
                    }
                } catch (error) {
                    sendFailures.push(app.name + ' (' + error.message + ')');
                    failedApps.push(app);
                }
            }

            if (sendFailures.length || historyWarnings.length) {
                var details = [];
                if (sendFailures.length) details.push('Chưa gửi: ' + sendFailures.join('; '));
                if (historyWarnings.length) details.push('Đã gửi nhưng lỗi lưu lịch sử: ' + historyWarnings.join(', '));
                progress.textContent = details.join(' | ');
                showToast('Hoàn tất ' + sent + '/' + draft.apps.length + ' email. ' + (sendFailures.length ? 'Có thư gửi lỗi.' : 'Có lỗi lưu lịch sử.'), 'warning');
            } else {
                progress.textContent = 'Hoàn tất ' + sent + '/' + draft.apps.length + ' email.';
                showToast('Đã gửi và lưu lịch sử cho ' + sent + ' ứng viên!', 'success');
            }
            if (failedApps.length) {
                draft.apps = failedApps;
                draft.currentId = String(failedApps[0].id);
                renderBulkPreview();
                progress.textContent = 'Còn ' + failedApps.length + ' thư chưa gửi. Bạn có thể kiểm tra rồi bấm gửi lại; các thư thành công đã được loại khỏi lượt này. ' + progress.textContent;
            } else {
                window.bulkEmailDraft = null;
                setTimeout(function () { closeModal('bulkEmailPreviewModal'); }, 800);
                if (typeof renderTab === 'function') renderTab('members');
            }
        } catch (error) {
            console.error(error);
            progress.textContent = 'Đã dừng: ' + (error.message || 'Lỗi không xác định');
            showToast(error.message || 'Không thể gửi email hàng loạt.', 'error');
        } finally {
            button.disabled = false;
            button.textContent = '📤 Gửi tất cả email đã duyệt';
        }
    };
})();
