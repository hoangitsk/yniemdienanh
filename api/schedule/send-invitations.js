const admin = require('firebase-admin');
const { generateGeminiJson, getGeminiConfig } = require('../../lib/gemini');
const { PROJECT_HANDBOOK_EMAIL_CONTEXT } = require('../../lib/projectIdentity');
const { preferredSender, sendMailWithFallback } = require('../../lib/mailer');
const { isScheduleManager } = require('../../lib/schedulePermissions');

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function(char) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
}

function getDb() {
    if (!admin.apps.length) {
        var raw = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT chưa được cấu hình.');
        var account = JSON.parse(raw.replace(/^"|"$/g, ''));
        if (typeof account === 'string') account = JSON.parse(account);
        if (account.private_key) account.private_key = account.private_key.replace(/\\n/g, '\n');
        admin.initializeApp({ credential: admin.credential.cert(account) });
    }
    return admin.firestore();
}

function isEligibleInterviewer(profile) {
    var role = String(profile && profile.role || '').trim().toLowerCase();
    var position = String(profile && (profile.position || profile.title) || '').trim().toLowerCase();
    var email = String(profile && profile.email || '').trim().toLowerCase();
    var leadership = position;
    return email === 'yniemdienanh@gmail.com' || ['admin', 'organizer', 'president', 'core'].indexOf(role) !== -1 ||
        leadership.indexOf('core') !== -1 || leadership.indexOf('president') !== -1 ||
        leadership.indexOf('chủ tịch') !== -1 || leadership.indexOf('chu tich') !== -1 ||
        leadership.indexOf('ban điều hành') !== -1 || leadership.indexOf('ban dieu hanh') !== -1;
}

function compactProfileText(value, limit) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

async function generatePersonalizedInvitation(candidate, interviewer, event) {
    // Không để AI chặn việc gửi thư: khi AI không khả dụng, email chuẩn bên dưới vẫn được gửi.
    const geminiConfig = getGeminiConfig();
    if (!geminiConfig.keys.length) return null;
    const candidateIntro = compactProfileText(candidate.intro, 1000);
    const candidateInterest = compactProfileText(candidate.interest, 300);
    const interviewerIntro = compactProfileText(interviewer.intro, 700);
    const interviewerDept = compactProfileText(interviewer.dept, 120);
    const prompt = `Bạn là trợ lý soạn lời mời phỏng vấn cá nhân hoá cho dự án Ý Niệm Điện Ảnh.

Ngữ cảnh dự án:
${PROJECT_HANDBOOK_EMAIL_CONTEXT}

Thông tin ứng viên (chỉ dùng để cá nhân hoá, không suy diễn thêm):
- Tên: ${compactProfileText(candidate.name, 120)}
- Ban/vai trò quan tâm: ${compactProfileText(candidate.dept, 160) || 'Chưa nêu'}
- Sở thích: ${candidateInterest || 'Chưa nêu'}
- Giới thiệu: ${candidateIntro || 'Chưa nêu'}

Thông tin người phỏng vấn:
- Tên: ${compactProfileText(interviewer.name, 120)}
- Ban/vai trò: ${interviewerDept || 'Chưa nêu'}
- Giới thiệu: ${interviewerIntro || 'Chưa nêu'}

Lịch: ${compactProfileText(event.title, 180)}.

Yêu cầu rất quan trọng:
- Đây là thư mời phỏng vấn đã được HR/Admin duyệt lịch, KHÔNG phải thư báo đã qua vòng 1.
- Không hứa hẹn kết quả tuyển chọn, không chấm điểm, không bịa kỹ năng hay thành tích.
- Giọng văn ấm áp, cụ thể, tôn trọng; chỉ tham chiếu nhẹ đến chi tiết thật từ phần giới thiệu nếu có.
- Quy tắc xưng hô bắt buộc: luôn gọi người nhận là "bạn" và xưng từ phía dự án là "chúng tôi" hoặc lược chủ ngữ. Không dùng "em", "anh", "chị", "cô", "chú" hay suy đoán tuổi, giới tính hoặc vai vế từ thông tin hồ sơ. Quy tắc này áp dụng cho mọi trường JSON, kể cả khi ứng viên tự xưng là "em" trong phần giới thiệu.
- Trả về JSON thuần với đúng ba trường, mỗi trường là văn bản tiếng Việt ngắn, không HTML:
{
  "candidateOpener": "1-2 câu mở đầu cá nhân hoá gửi ứng viên",
  "candidateFocus": "1 câu gợi ý nội dung hai bên có thể trao đổi trong buổi phỏng vấn",
  "interviewerBrief": "1-2 câu tóm tắt trung lập để người phỏng vấn chuẩn bị"
}`;
    const controller = new AbortController();
    const timeout = setTimeout(function() { controller.abort(); }, 2000);
    const timedFetch = function(url, options) {
        return fetch(url, Object.assign({}, options, { signal:controller.signal }));
    };
    try {
        const result = await generateGeminiJson(prompt, {
            keys:geminiConfig.keys,
            models:geminiConfig.models,
            fetchImpl:timedFetch
        });
        const copy = result.data || {};
        return {
            candidateOpener: compactProfileText(copy.candidateOpener, 500),
            candidateFocus: compactProfileText(copy.candidateFocus, 400),
            interviewerBrief: compactProfileText(copy.interviewerBrief, 600)
        };
    } catch (error) {
        console.warn('Không thể cá nhân hoá thư mời bằng AI:', error.message || error);
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

module.exports = async function sendInterviewInvitations(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
        var body = req.body || {};
        if (!body.idToken || !body.eventId || !body.bookingId) {
            return res.status(400).json({ error: 'Thiếu thông tin lịch hoặc người đặt.' });
        }

        var db = getDb();
        var decoded = await admin.auth().verifyIdToken(body.idToken);
        var operatorDoc = await db.collection('users').doc(decoded.uid).get();
        var operator = operatorDoc.exists ? operatorDoc.data() : {};
        var isProjectAdmin = String(decoded.email || '').toLowerCase() === 'yniemdienanh@gmail.com';
        if (!decoded.email_verified || !isScheduleManager(decoded, operator)) {
            return res.status(403).json({ error: 'Chỉ Admin/BTC mới có thể gửi thư mời.' });
        }

        var data = await Promise.all([
            db.collection('scheduledEvents').doc(body.eventId).get(),
            db.collection('scheduledBookings').doc(body.bookingId).get(),
            db.collection('users').get()
        ]);
        var eventDoc = data[0];
        var bookingDoc = data[1];
        var usersSnap = data[2];
        if (!eventDoc.exists || !bookingDoc.exists) {
            return res.status(404).json({ error: 'Không tìm thấy lịch hoặc lượt đặt.' });
        }

        var event = eventDoc.data();
        var booking = bookingDoc.data();
        if (booking.eventId !== body.eventId || booking.status !== 'confirmed') {
            return res.status(400).json({ error: 'Chỉ gửi thư sau khi lượt đặt đã được xác nhận.' });
        }
        if (!event.location || !/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}(?:\?.*)?$/i.test(event.location.trim())) {
            return res.status(400).json({ error: 'Hãy thêm liên kết Google Meet hợp lệ trước khi gửi thư.' });
        }
        if (!booking.candidateEmail) return res.status(400).json({ error: 'Ứng viên chưa có email hợp lệ.' });

        if (event.type === 'interview' && !event.assignedHrId) return res.status(400).json({ error: 'Lịch chưa được phân công người phỏng vấn.' });
        // Người phỏng vấn có thể được lưu bằng Firebase UID hoặc id số của hồ sơ
        // (list-users trả về cả hai kiểu), nên tìm theo UID, id, hoặc email.
        var assignedHrId = String(event.assignedHrId || '');
        var assignedHrEmail = String(event.assignedHrEmail || '').trim().toLowerCase();
        var assignedHrDoc = usersSnap.docs.find(function(doc) {
            var profile = doc.data() || {};
            return doc.id === assignedHrId || String(profile.id || '') === assignedHrId ||
                String(profile.email || '').trim().toLowerCase() === assignedHrEmail;
        });
        var assignedHr = assignedHrDoc ? assignedHrDoc.data() : {};
        assignedHr.email = assignedHr.email || event.assignedHrEmail || '';
        assignedHr.name = assignedHr.name || event.assignedHrName || '';
        assignedHr.role = assignedHr.role || event.assignedHrRole || '';
        assignedHr.dept = assignedHr.dept || event.assignedHrDept || '';
        assignedHr.position = assignedHr.position || event.assignedHrPosition || '';
        if (event.type === 'interview' && (!assignedHr || !assignedHr.email || !isEligibleInterviewer(assignedHr))) {
            return res.status(400).json({ error: 'Người phỏng vấn được phân công không hợp lệ hoặc chưa có email.' });
        }
        // Chỉ ứng viên và người được phân công phỏng vấn nhận email.
        // Admin xem link Meet trong lịch quản trị, không nhận thư mời tự động.
        var staffEmails = event.type === 'interview'
            ? [assignedHr.email.trim().toLowerCase()]
            : [String(decoded.email || '').trim().toLowerCase()].filter(Boolean);
        var candidateDoc = usersSnap.docs.find(function(doc) { return doc.id === booking.candidateId; });
        var candidateProfile = candidateDoc ? candidateDoc.data() : {};
        candidateProfile.name = candidateProfile.name || booking.candidateName || '';
        candidateProfile.email = candidateProfile.email || booking.candidateEmail || '';

        var start = new Date(event.startAt);
        var time = isNaN(start) ? 'theo lịch đã thông báo' : start.toLocaleString('vi-VN', {
            dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh'
        });
        var title = escapeHtml(event.title || (event.type === 'interview' ? 'Phỏng vấn' : 'Cuộc họp'));
        var meetUrl = escapeHtml(event.location.trim());
        var notes = event.notes ? '<p><strong>Lưu ý:</strong> ' + escapeHtml(event.notes) + '</p>' : '';
        var candidateName = escapeHtml(booking.candidateName || 'bạn');
        var useAiPersonalization = body.aiPersonalized !== false;
        var aiCopy = event.type === 'interview' && useAiPersonalization
            ? await generatePersonalizedInvitation(candidateProfile, assignedHr, event)
            : null;
        var candidatePersonalization = aiCopy && (aiCopy.candidateOpener || aiCopy.candidateFocus)
            ? '<p>' + escapeHtml(aiCopy.candidateOpener) + '</p>' + (aiCopy.candidateFocus ? '<p>' + escapeHtml(aiCopy.candidateFocus) + '</p>' : '')
            : '';
        var interviewerPersonalization = aiCopy && aiCopy.interviewerBrief
            ? '<p><strong>Gợi ý chuẩn bị:</strong> ' + escapeHtml(aiCopy.interviewerBrief) + '</p>'
            : '';
        // Thư lịch ưu tiên Brevo; Gmail chỉ được dùng khi Brevo chưa cấu hình hoặc tạm thời lỗi.
        var sender = preferredSender('brevo');
        if (!sender) throw new Error('Chưa cấu hình kênh gửi email trên máy chủ.');
        var fromEmail = sender.email;
        var candidateHtml = '<p>Chào ' + candidateName + ',</p>' + candidatePersonalization + '<p>Trân trọng mời bạn tham gia buổi phỏng vấn <strong>' + title + '</strong>.</p><p><strong>Thời gian:</strong> ' + escapeHtml(time) + '<br><strong>Google Meet:</strong> <a href="' + meetUrl + '">' + meetUrl + '</a></p>' + notes + '<p>Vui lòng vào phòng trước 5–10 phút. Nếu cần hỗ trợ, hãy phản hồi email này.</p>';
        var staffHtml = '<p>Chào ' + escapeHtml((assignedHr && assignedHr.name) || 'người phụ trách') + ',</p><p>Bạn được phân công phỏng vấn ứng viên <strong>' + candidateName + '</strong> trong lịch <strong>' + title + '</strong>.</p>' + interviewerPersonalization + '<p><strong>Thời gian:</strong> ' + escapeHtml(time) + '<br><strong>Google Meet:</strong> <a href="' + meetUrl + '">' + meetUrl + '</a></p>' + notes;
        var wrap = function(html) {
            return '<div style="max-width:600px;margin:auto;padding:28px;font-family:Arial,sans-serif;line-height:1.65;color:#1f2937">' + html + '<hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0"><small>Ý Niệm Điện Ảnh · Thư mời lịch làm việc</small></div>';
        };
        var icsDate = function(date) {
            return new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
        };
        var icsText = function(value) {
            return String(value || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
        };
        var createIcs = function(attendee) {
            var end = new Date(start.getTime() + Number(event.duration || 30) * 60000);
            return [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//YNDA//Schedule//VI',
                'METHOD:REQUEST',
                'BEGIN:VEVENT',
                'UID:' + body.bookingId + '@yniemdienanh.vn',
                'DTSTAMP:' + icsDate(new Date()),
                'DTSTART:' + icsDate(start),
                'DTEND:' + icsDate(end),
                'SUMMARY:' + icsText(event.title),
                'DESCRIPTION:' + icsText((event.notes || '') + '\nGoogle Meet: ' + event.location),
                'LOCATION:' + icsText(event.location),
                'URL:' + event.location,
                'ORGANIZER;CN=Ý Niệm Điện Ảnh:mailto:' + fromEmail,
                'ATTENDEE;RSVP=TRUE:mailto:' + attendee,
                'STATUS:CONFIRMED',
                'END:VEVENT',
                'END:VCALENDAR'
            ].join('\r\n');
        };

        var candidateEmail = booking.candidateEmail.trim().toLowerCase();
        var recipients = Array.from(new Set(staffEmails)).filter(function(email) { return email !== candidateEmail; });
        var messages = [
            sendMailWithFallback({
                to: candidateEmail,
                subject: '[Ý Niệm Điện Ảnh] Xác nhận ' + (event.type === 'interview' ? 'phỏng vấn' : 'lịch họp') + ' — ' + event.title,
                html: wrap(candidateHtml),
                icalEvent: { method: 'request', content: createIcs(candidateEmail) }
            }, { fromName:sender.name, preferredProvider:'brevo' })
        ];
        recipients.forEach(function(email) {
            messages.push(sendMailWithFallback({
                to: email,
                subject: '[Người phỏng vấn] ' + (event.type === 'interview' ? 'Lịch phỏng vấn' : 'Lịch họp') + ' đã xác nhận — ' + event.title,
                html: wrap(staffHtml),
                icalEvent: { method: 'request', content: createIcs(email) }
            }, { fromName:sender.name, preferredProvider:'brevo' }));
        });
        var results = await Promise.allSettled(messages);
        var failed = results.filter(function(result) { return result.status === 'rejected'; }).length;
        if (failed) throw new Error('Không gửi được ' + failed + ' thư mời.');
        var providers = Array.from(new Set(results.filter(function(result) {
            return result.status === 'fulfilled' && result.value && result.value.provider;
        }).map(function(result) { return result.value.provider; })));

        await bookingDoc.ref.update({
            invitationSentAt: new Date().toISOString(),
            invitationSentBy: decoded.uid,
            invitationProviders: providers
        });
        try {
            var eventInvitationUpdate = {
                lastInvitationSentAt: new Date().toISOString(),
                lastInvitationProviders: providers
            };
            if (event.type === 'interview') {
                eventInvitationUpdate.invitationSentAt = eventInvitationUpdate.lastInvitationSentAt;
                eventInvitationUpdate.candidateId = booking.candidateId;
                eventInvitationUpdate.candidateName = booking.candidateName || '';
                eventInvitationUpdate.candidateEmail = booking.candidateEmail || '';
                eventInvitationUpdate.status = 'confirmed';
            }
            await eventDoc.ref.set(eventInvitationUpdate, { merge: true });
        } catch (metadataError) {
            console.warn('KhÃ´ng thÃªm Ä‘Æ°á»£c metadata email vÃ o lá»‹ch:', metadataError.message || metadataError);
        }
        return res.status(200).json({ success: true, recipients: recipients.length + 1, personalized: !!aiCopy, providers:providers });
    } catch (error) {
        console.error('Schedule invitation error:', error);
        return res.status(500).json({ error: error.message || 'Không thể gửi thư mời.' });
    }
};
