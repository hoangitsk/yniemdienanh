const admin = require('firebase-admin');
const { isScheduleManager, isInterviewStaff: isInterviewStaffProfile } = require('../../lib/schedulePermissions');

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

function isOrganizer(decoded, profile) {
    return isScheduleManager(decoded, profile);
}

function isInterviewStaff(decoded, profile) {
    if (isInterviewStaffProfile(decoded, profile)) return true;
    const role = String(profile.role || '').trim().toLowerCase();
    const context = [profile.dept, profile.position, profile.title].map(value => String(value || '').trim().toLowerCase()).join(' ');
    return isOrganizer(decoded, profile) || ['president', 'core'].includes(role) ||
        context.includes('nhân sự') || context.includes('nhan su') || context.includes('hr') ||
        context.includes('core') || context.includes('president') ||
        context.includes('chủ tịch') || context.includes('chu tich');
}

function allowedSlotIds(poll) {
    const result = new Set();
    const start = new Date(String(poll.startDate || '') + 'T00:00:00+07:00');
    if (Number.isNaN(start.getTime())) return result;
    const dayCount = Math.max(1, Math.min(14, Number(poll.dayCount || 7)));
    for (let day = 0; day < dayCount; day += 1) {
        const date = new Date(start);
        date.setUTCDate(date.getUTCDate() + day);
        const dateId = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(date);
        for (let shift = 0; shift < 18; shift += 1) result.add(dateId + '_' + shift);
    }
    return result;
}

module.exports = async function saveAvailability(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
        const body = req.body || {};
        if (!body.idToken || !body.pollId) return res.status(400).json({ error: 'Thiếu thông tin xác thực hoặc đợt vote.' });

        const db = getDb();
        const decoded = await admin.auth().verifyIdToken(body.idToken);
        const [profileDoc, pollDoc] = await Promise.all([
            db.collection('users').doc(decoded.uid).get(),
            db.collection('availabilityPolls').doc(String(body.pollId)).get()
        ]);
        if (!pollDoc.exists) return res.status(404).json({ error: 'Đợt vote không còn tồn tại.' });

        const profile = profileDoc.exists ? profileDoc.data() : {};
        const poll = pollDoc.data();
        const organizer = isOrganizer(decoded, profile);
        const signedInEmail = String(decoded.email || '').trim().toLowerCase();
        const assigned = poll.isPublic === true ||
            (Array.isArray(poll.participantIds) && poll.participantIds.includes(decoded.uid)) ||
            (signedInEmail && Array.isArray(poll.participantEmails) && poll.participantEmails.some(email => String(email).trim().toLowerCase() === signedInEmail));
        if (!decoded.email_verified && !organizer) return res.status(403).json({ error: 'Tài khoản chưa xác thực email.' });
        if (!organizer && !assigned) return res.status(403).json({ error: 'Tài khoản không nằm trong danh sách của đợt vote.' });

        const docId = String(body.pollId) + '_' + decoded.uid;
        const ref = db.collection('meetingSchedules').doc(docId);
        const existingDoc = await ref.get();
        const existingSchedule = existingDoc.exists ? existingDoc.data() : null;
        if (body.action === 'delete') {
            if (!organizer && existingSchedule && (existingSchedule.completedAt || existingSchedule.finalizedAt)) {
                return res.status(403).json({ error: 'Phiếu đã hoàn tất nên chỉ Admin/HR/PR có thể thay đổi.' });
            }
            const deleteEnd = new Date(String(poll.startDate || '') + 'T00:00:00+07:00');
            deleteEnd.setUTCDate(deleteEnd.getUTCDate() + Math.max(1, Math.min(14, Number(poll.dayCount || 7))));
            if (!organizer && (Number.isNaN(deleteEnd.getTime()) || Date.now() >= deleteEnd.getTime())) {
                return res.status(403).json({ error: 'Availability poll has expired.' });
            }
            if (!organizer && poll.status !== 'open') return res.status(403).json({ error: 'Đợt vote đã khóa nên không thể xóa.' });
            await ref.delete();
            return res.status(200).json({ success: true, deleted: true, id: docId });
        }

        if (body.action === 'finalize') {
            if (!existingSchedule || !Array.isArray(existingSchedule.slots) || !existingSchedule.slots.length) {
                return res.status(400).json({ error: 'Hãy chọn và lưu ít nhất một khung giờ trước khi hoàn tất.' });
            }
            if (existingSchedule.slots.length < 3) {
                return res.status(400).json({ error: 'Yêu cầu chọn tối thiểu 3 khung giờ rảnh trước khi hoàn tất.' });
            }
            if (existingSchedule.completedAt || existingSchedule.finalizedAt) {
                return res.status(200).json({ success: true, schedule: { id: docId, ...existingSchedule } });
            }
            if (!organizer && poll.status !== 'open') return res.status(403).json({ error: 'Đợt vote đã khóa.' });
            const finalizeEnd = new Date(String(poll.startDate || '') + 'T00:00:00+07:00');
            finalizeEnd.setUTCDate(finalizeEnd.getUTCDate() + Math.max(1, Math.min(14, Number(poll.dayCount || 7))));
            if (!organizer && (Number.isNaN(finalizeEnd.getTime()) || Date.now() >= finalizeEnd.getTime())) {
                return res.status(403).json({ error: 'Đợt vote đã hết hạn.' });
            }
            const completedAt = new Date().toISOString();
            const schedule = { ...existingSchedule, id: docId, completedAt, finalizedAt: completedAt, finalizedBy: decoded.uid };
            await ref.set({ completedAt, finalizedAt: completedAt, finalizedBy: decoded.uid }, { merge: true });
            return res.status(200).json({ success: true, schedule });
        }

        if (poll.status !== 'open') return res.status(403).json({ error: 'Đợt vote đã khóa nên không thể lưu.' });
        if (!organizer && existingSchedule && (existingSchedule.completedAt || existingSchedule.finalizedAt)) {
            return res.status(403).json({ error: 'Phiếu đã hoàn tất nên không thể chỉnh sửa.' });
        }
        const end = new Date(String(poll.startDate || '') + 'T00:00:00+07:00');
        end.setUTCDate(end.getUTCDate() + Math.max(1, Math.min(14, Number(poll.dayCount || 7))));
        if (poll.status !== 'open' || Number.isNaN(end.getTime()) || Date.now() >= end.getTime()) {
            return res.status(403).json({ error: 'Availability poll is closed or expired.' });
        }
        const validSlots = allowedSlotIds(poll);
        const slots = Array.from(new Set(Array.isArray(body.slots) ? body.slots.map(String) : []))
            .filter((slotId) => validSlots.has(slotId));
        const slotSet = new Set(slots);
        const preferredSlots = Array.from(new Set(Array.isArray(body.preferredSlots) ? body.preferredSlots.map(String) : []))
            .filter((slotId) => slotSet.has(slotId));
        const slotSchema = body.slotSchema === '30m-v1' ? '30m-v1' : (existingSchedule && existingSchedule.slotSchema) || 'legacy-90m';
        const allowedRoles = new Set(['member', 'btc', 'candidate', 'mentor']);
        const requestedRole = allowedRoles.has(body.role) ? body.role : 'member';
        // Người tham gia không phải hiểu vai trò nội bộ: đợt phỏng vấn tự phân biệt
        // người phỏng vấn và ứng viên dựa trên hồ sơ tài khoản.
        const role = poll.type === 'interview'
            ? (isInterviewStaff(decoded, profile) ? 'btc' : 'candidate')
            : requestedRole;
        const name = String(body.name || decoded.name || profile.name || String(decoded.email || '').split('@')[0] || 'Thành viên').trim().slice(0, 150);
        const schedule = {
            id: docId,
            ownerId: decoded.uid,
            pollId: String(body.pollId),
            pollTitle: String(poll.title || '').slice(0, 150),
            name,
            role,
            slots,
            preferredSlots,
            slotSchema,
            rangeStart: poll.startDate || null,
            dayCount: Math.max(1, Math.min(14, Number(poll.dayCount || 7))),
            submittedAt: new Date().toISOString()
        };
        if (existingSchedule && existingSchedule.completedAt) schedule.completedAt = existingSchedule.completedAt;
        if (existingSchedule && existingSchedule.finalizedAt) schedule.finalizedAt = existingSchedule.finalizedAt;
        if (existingSchedule && existingSchedule.finalizedBy) schedule.finalizedBy = existingSchedule.finalizedBy;
        await ref.set(schedule);
        return res.status(200).json({ success: true, schedule });
    } catch (error) {
        console.error('Save availability error:', error);
        const status = error.code === 'auth/id-token-expired' ? 401 : 500;
        return res.status(status).json({ error: error.message || 'Không thể lưu lịch rảnh.' });
    }
};
