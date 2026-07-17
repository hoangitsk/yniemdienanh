const admin = require('firebase-admin');
const { isScheduleManager } = require('../../lib/schedulePermissions');

function getDb() {
    if (!admin.apps.length) {
        let raw = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT chưa được cấu hình.');
        raw = raw.trim().replace(/^"|"$/g, '');
        let account = JSON.parse(raw);
        if (typeof account === 'string') account = JSON.parse(account);
        if (account.private_key) account.private_key = account.private_key.replace(/\\n/g, '\n');
        admin.initializeApp({ credential: admin.credential.cert(account) });
    }
    return admin.firestore();
}

module.exports = async function cancelBooking(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
        const body = req.body || {};
        if (!body.idToken || !body.eventId) return res.status(400).json({ error: 'Thiếu thông tin xác thực hoặc mã lịch.' });
        const db = getDb();
        const decoded = await admin.auth().verifyIdToken(body.idToken);
        const profileDoc = await db.collection('users').doc(decoded.uid).get();
        const profile = profileDoc.exists ? profileDoc.data() : {};
        const manager = isScheduleManager(decoded, profile);

        const eventRef = db.collection('scheduledEvents').doc(String(body.eventId));
        const eventDoc = await eventRef.get();
        if (!eventDoc.exists) return res.status(404).json({ error: 'Lịch không còn tồn tại.' });
        const event = eventDoc.data();
        if (event.candidateId !== decoded.uid && !manager) {
            return res.status(403).json({ error: 'Bạn không phải người tham gia lịch này.' });
        }
        const pollId = body.pollId || event.availabilityPollId || '';

        const now = new Date().toISOString();

        const batch = db.batch();

        const bookingId = body.bookingId || event.id + '_' + decoded.uid;
        const bookingRef = db.collection('scheduledBookings').doc(bookingId);
        batch.set(bookingRef, {
            status: 'cancelled',
            cancelledAt: now,
            cancelledBy: decoded.uid,
            cancellationReason: body.reason || 'Người tham gia hủy lịch.',
            updatedAt: now
        }, { merge: true });

        const bookingsSnap = await db.collection('scheduledBookings')
            .where('eventId', '==', String(body.eventId))
            .where('status', '==', 'confirmed')
            .get();
        const otherConfirmedBookings = bookingsSnap.docs.some(doc => doc.id !== bookingId);

        if (!otherConfirmedBookings) {
            batch.update(eventRef, {
                status: 'cancelled',
                cancelledAt: now,
                cancelledBy: decoded.uid,
                cancellationReason: 'Người tham gia hủy lịch.',
                updatedAt: now
            });
        }

        if (pollId) {
            const scheduleId = pollId + '_' + decoded.uid;
            const scheduleRef = db.collection('meetingSchedules').doc(scheduleId);
            batch.update(scheduleRef, {
                completedAt: admin.firestore.FieldValue.delete(),
                finalizedAt: admin.firestore.FieldValue.delete(),
                finalizedBy: admin.firestore.FieldValue.delete(),
                manuallyUpdatedByAdmin: true
            });
        }

        await batch.commit();

        try {
            const { sendMailWithFallback } = require('../../lib/mailer');
            const hrEmail = event.assignedHrEmail || '';
            const hrName = event.assignedHrName || 'Người phỏng vấn';
            const userName = decoded.displayName || decoded.email || 'Người tham gia';
            const appName = process.env.APP_NAME || 'Ý Niệm Điện Ảnh';
            const subject = '[Hủy lịch] ' + userName + ' đã hủy lịch ' + (event.type === 'interview' ? 'phỏng vấn' : 'họp');

            const recipients = [String(process.env.BREVO_SENDER_EMAIL || '').trim() || 'yniemdienanh@gmail.com'];
            if (hrEmail && hrEmail !== recipients[0]) recipients.push(hrEmail);

            for (const to of recipients) {
                try {
                    await sendMailWithFallback({
                        to,
                        subject,
                        html: '<p><strong>' + userName.replace(/[<>&"]/g, '') + '</strong> đã hủy lịch <strong>' + String(event.title || '').replace(/[<>&"]/g, '') + '</strong>.</p>' +
                            '<p><strong>Thời gian cũ:</strong> ' + String(event.startAt || '').replace(/[<>&"]/g, '') + '</p>' +
                            '<hr><p style="color:#888">Email này được gửi tự động từ ' + appName.replace(/[<>&"]/g, '') + '.</p>'
                    });
                } catch (_) {}
            }
        } catch (_) {}

        return res.status(200).json({ success: true, cancelledAt: now });
    } catch (error) {
        console.error('Cancel booking error:', error);
        return res.status(error.code === 'auth/id-token-expired' ? 401 : 500).json({ error: error.message || 'Không thể hủy lịch.' });
    }
};
