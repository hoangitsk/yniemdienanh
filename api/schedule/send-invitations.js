const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

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
        if (!decoded.email_verified || (!isProjectAdmin && ['admin', 'organizer'].indexOf(operator.role) === -1)) {
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

        if (event.type === 'interview' && !event.assignedHrId) return res.status(400).json({ error: 'Lịch chưa được phân công HR phụ trách.' });
        var assignedHrDoc = usersSnap.docs.find(function(doc) { return doc.id === event.assignedHrId; });
        var assignedHr = assignedHrDoc ? assignedHrDoc.data() : null;
        var hrDept = assignedHr ? String(assignedHr.dept || '').toLowerCase() : '';
        var validHrDept = hrDept.indexOf('nhân sự') !== -1 || hrDept.indexOf('nhan su') !== -1 || hrDept === 'hr';
        if (event.type === 'interview' && (!assignedHr || !assignedHr.email || !validHrDept)) {
            return res.status(400).json({ error: 'HR được phân công không còn hợp lệ hoặc chưa có email.' });
        }
        var staffEmails = event.type === 'interview'
            ? [assignedHr.email.trim().toLowerCase()]
            : [String(decoded.email || '').trim().toLowerCase()].filter(Boolean);

        var start = new Date(event.startAt);
        var time = isNaN(start) ? 'theo lịch đã thông báo' : start.toLocaleString('vi-VN', {
            dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh'
        });
        var title = escapeHtml(event.title || (event.type === 'interview' ? 'Phỏng vấn' : 'Cuộc họp'));
        var meetUrl = escapeHtml(event.location.trim());
        var notes = event.notes ? '<p><strong>Lưu ý:</strong> ' + escapeHtml(event.notes) + '</p>' : '';
        var candidateName = escapeHtml(booking.candidateName || 'bạn');
        var transporter = nodemailer.createTransport({
            host: 'smtp-relay.brevo.com',
            port: 587,
            secure: false,
            auth: { user: process.env.BREVO_SMTP_LOGIN, pass: process.env.BREVO_SMTP_KEY }
        });
        var fromEmail = process.env.BREVO_FROM_EMAIL;
        if (!fromEmail) throw new Error('BREVO_FROM_EMAIL chưa được cấu hình.');
        var from = '"' + (process.env.BREVO_FROM_NAME || 'Ý Niệm Điện Ảnh') + '" <' + fromEmail + '>';
        var candidateHtml = '<p>Chào ' + candidateName + ',</p><p>Lịch <strong>' + title + '</strong> của bạn đã được xác nhận.</p><p><strong>Thời gian:</strong> ' + escapeHtml(time) + '<br><strong>Google Meet:</strong> <a href="' + meetUrl + '">' + meetUrl + '</a></p>' + notes + '<p>Vui lòng vào phòng trước 5–10 phút. Nếu cần hỗ trợ, hãy phản hồi email này.</p>';
        var staffHtml = '<p>Chào ' + escapeHtml((assignedHr && assignedHr.name) || 'người phụ trách') + ',</p><p>Bạn được phân công ' + (event.type === 'interview' ? 'phỏng vấn ứng viên ' : 'tham gia cùng ') + '<strong>' + candidateName + '</strong> trong lịch <strong>' + title + '</strong>.</p><p><strong>Thời gian:</strong> ' + escapeHtml(time) + '<br><strong>Google Meet:</strong> <a href="' + meetUrl + '">' + meetUrl + '</a></p>' + notes;
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
            transporter.sendMail({
                from: from,
                to: candidateEmail,
                subject: '[Ý Niệm Điện Ảnh] Xác nhận ' + (event.type === 'interview' ? 'phỏng vấn' : 'lịch họp') + ' — ' + event.title,
                html: wrap(candidateHtml),
                icalEvent: { method: 'request', content: createIcs(candidateEmail) }
            })
        ];
        recipients.forEach(function(email) {
            messages.push(transporter.sendMail({
                from: from,
                to: email,
                subject: '[HR phụ trách] ' + (event.type === 'interview' ? 'Lịch phỏng vấn' : 'Lịch họp') + ' đã xác nhận — ' + event.title,
                html: wrap(staffHtml),
                icalEvent: { method: 'request', content: createIcs(email) }
            }));
        });
        var results = await Promise.allSettled(messages);
        var failed = results.filter(function(result) { return result.status === 'rejected'; }).length;
        if (failed) throw new Error('Không gửi được ' + failed + ' thư mời.');

        await bookingDoc.ref.update({
            invitationSentAt: new Date().toISOString(),
            invitationSentBy: decoded.uid
        });
        return res.status(200).json({ success: true, recipients: recipients.length + 1 });
    } catch (error) {
        console.error('Schedule invitation error:', error);
        return res.status(500).json({ error: error.message || 'Không thể gửi thư mời.' });
    }
};
