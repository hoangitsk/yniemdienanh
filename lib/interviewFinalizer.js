'use strict';

const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

const TIME_ZONE = 'Asia/Ho_Chi_Minh';
const PROJECT_ADMIN_EMAIL = 'yniemdienanh@gmail.com';
const SHIFTS = [
    { name: 'Ca 1', time: '08:00 - 09:30' },
    { name: 'Ca 2', time: '09:30 - 11:00' },
    { name: 'Ca 3', time: '13:30 - 15:00' },
    { name: 'Ca 4', time: '15:00 - 16:30' },
    { name: 'Ca 5', time: '19:30 - 21:00' },
    { name: 'Ca 6', time: '21:00 - 22:30' }
];

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

function vnDateId(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date).reduce((result, part) => {
        result[part.type] = part.value;
        return result;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDays(dateId, days) {
    const [year, month, day] = dateId.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function normalizeText(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function slotInfo(slotId) {
    const match = String(slotId || '').match(/^(\d{4}-\d{2}-\d{2})_(\d+)$/);
    if (!match || !SHIFTS[Number(match[2])]) return null;
    return { id: slotId, dateId: match[1], shiftIndex: Number(match[2]), shift: SHIFTS[Number(match[2])] };
}

function slotStartAt(info) {
    const time = info.shift.time.split(' - ')[0];
    return new Date(`${info.dateId}T${time}:00+07:00`).toISOString();
}

function isHrUser(user) {
    const dept = normalizeText(user && user.dept);
    return dept.includes('nhan su') || dept === 'hr';
}

function isInterviewStaffUser(user) {
    const role = normalizeText(user && user.role);
    const context = normalizeText([user && user.dept, user && user.position, user && user.title].filter(Boolean).join(' '));
    return normalizeText(user && user.email) === PROJECT_ADMIN_EMAIL ||
        ['admin', 'organizer', 'president', 'core'].includes(role) ||
        context.includes('nhan su') || context.includes('hr') || context.includes('core') ||
        context.includes('president') || context.includes('chu tich');
}

function findApplication(candidate, account, applications) {
    const email = normalizeText(account && account.email);
    const name = normalizeText((account && account.name) || candidate.name);
    return applications.find(application =>
        (email && normalizeText(application.email) === email) ||
        (name && normalizeText(application.name) === name)
    );
}

function needsProjectAdmin(application) {
    if (!application) return false;
    const dept = normalizeText(application.dept);
    return application.type === 'president' ||
        (application.position === 'core' && (dept.includes('nhan su') || dept === 'hr'));
}

async function getGoogleAccessToken() {
    const required = ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_CALENDAR_REFRESH_TOKEN'];
    const missing = required.filter(name => !process.env[name]);
    if (missing.length) throw new Error(`Thiếu cấu hình Google Calendar: ${missing.join(', ')}`);

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
            client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
            refresh_token: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN,
            grant_type: 'refresh_token'
        })
    });
    const data = await response.json();
    if (!response.ok || !data.access_token) throw new Error(data.error_description || 'Không lấy được quyền Google Calendar.');
    return data.access_token;
}

async function createGoogleMeet(eventId, event, candidateEmail, hrEmail) {
    const token = await getGoogleAccessToken();
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    const start = new Date(event.startAt);
    const end = new Date(start.getTime() + Number(event.duration || 30) * 60000);
    const attendees = Array.from(new Set([candidateEmail, hrEmail].filter(Boolean).map(email => email.toLowerCase())))
        .map(email => ({ email }));
    const resource = {
        summary: event.title,
        description: `${event.notes || ''}\nLịch được chốt tự động lúc 0h Việt Nam.`,
        start: { dateTime: start.toISOString(), timeZone: TIME_ZONE },
        end: { dateTime: end.toISOString(), timeZone: TIME_ZONE },
        attendees,
        conferenceData: {
            createRequest: {
                requestId: `ynda_${eventId}_${Date.now()}`.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 100),
                conferenceSolutionKey: { type: 'hangoutsMeet' }
            }
        }
    };
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(resource)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Không tạo được sự kiện Google Calendar.');
    let meetLink = data.hangoutLink || data.conferenceData?.entryPoints?.find(item => item.entryPointType === 'video')?.uri;
    for (let attempt = 0; data.id && !meetLink && attempt < 5; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 750));
        const pollResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(data.id)}`, {
            headers: { Authorization:`Bearer ${token}` }
        });
        if (!pollResponse.ok) continue;
        const latest = await pollResponse.json();
        meetLink = latest.hangoutLink || latest.conferenceData?.entryPoints?.find(item => item.entryPointType === 'video')?.uri;
    }
    if (!meetLink) throw new Error('Google Calendar chưa trả về liên kết Meet.');
    return { meetLink, calendarEventId: data.id, calendarHtmlLink: data.htmlLink || '' };
}

async function addGoogleCalendarAttendees(event, candidateEmail, hrEmail) {
    if (!event.googleCalendarEventId) throw new Error('Lịch chưa có sự kiện Google Calendar.');
    const token = await getGoogleAccessToken();
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(event.googleCalendarEventId)}`;
    const currentResponse = await fetch(baseUrl, { headers:{ Authorization:`Bearer ${token}` } });
    const current = await currentResponse.json();
    if (!currentResponse.ok) throw new Error(current.error?.message || 'Không đọc được sự kiện Google Calendar.');
    const emails = new Set((current.attendees || []).map(item => String(item.email || '').trim().toLowerCase()).filter(Boolean));
    [candidateEmail, hrEmail].forEach(email => {
        const value = String(email || '').trim().toLowerCase();
        if (value) emails.add(value);
    });
    const response = await fetch(`${baseUrl}?sendUpdates=all`, {
        method:'PATCH',
        headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
        body:JSON.stringify({ attendees:Array.from(emails).map(email => ({ email })) })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Không thêm được người tham dự vào Google Calendar.');
    return { meetLink:data.hangoutLink || event.location || '', calendarEventId:data.id || event.googleCalendarEventId, calendarHtmlLink:data.htmlLink || event.googleCalendarHtmlLink || '' };
}

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
}

async function sendFinalizedInvitation(event, candidate, hr) {
    const fromEmail = process.env.BREVO_FROM_EMAIL;
    if (!fromEmail) throw new Error('BREVO_FROM_EMAIL chưa được cấu hình.');
    const transporter = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com', port: 587, secure: false,
        auth: { user: process.env.BREVO_SMTP_LOGIN, pass: process.env.BREVO_SMTP_KEY }
    });
    const from = `"${process.env.BREVO_FROM_NAME || 'Ý Niệm Điện Ảnh'}" <${fromEmail}>`;
    const time = new Date(event.startAt).toLocaleString('vi-VN', { dateStyle:'full', timeStyle:'short', timeZone:TIME_ZONE });
    const details = `<p><strong>Ca phỏng vấn:</strong> ${escapeHtml(event.slotName)} (${escapeHtml(event.slotTime)})<br><strong>Thời gian:</strong> ${escapeHtml(time)}<br><strong>Người phỏng vấn:</strong> ${escapeHtml(hr.name || hr.email)}<br><strong>Google Meet:</strong> <a href="${escapeHtml(event.location)}">${escapeHtml(event.location)}</a></p>`;
    const wrap = html => `<div style="max-width:600px;margin:auto;padding:28px;font-family:Arial,sans-serif;line-height:1.65;color:#1f2937">${html}<hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0"><small>Ý Niệm Điện Ảnh · Lịch phỏng vấn tự động</small></div>`;
    await Promise.all([
        transporter.sendMail({
            from, to: candidate.email,
            subject: `[Ý Niệm Điện Ảnh] Lịch phỏng vấn đã chốt — ${event.slotName}`,
            html: wrap(`<p>Chào ${escapeHtml(candidate.name || 'bạn')},</p><p>Dựa trên phiếu thời gian rảnh của bạn, hệ thống đã chốt lịch phỏng vấn.</p>${details}<p>Vui lòng vào phòng trước 5–10 phút.</p>`)
        }),
        transporter.sendMail({
            from, to: hr.email,
            subject: `[Người phỏng vấn] ${event.slotName} — ${candidate.name || candidate.email}`,
            html: wrap(`<p>Chào ${escapeHtml(hr.name || 'người phụ trách')},</p><p>Bạn được phân công phỏng vấn <strong>${escapeHtml(candidate.name || candidate.email)}</strong>.</p>${details}`)
        })
    ]);
}

function buildPlan({ poll, schedules, users, applications, existingEvents, bookings, now = new Date() }) {
    const usersById = new Map(users.map(user => [user.id, user]));
    const adminUser = users.find(user => normalizeText(user.email) === PROJECT_ADMIN_EMAIL);
    const effectiveRole = schedule => {
        if (['btc', 'candidate'].includes(schedule.role)) return schedule.role;
        return isInterviewStaffUser(usersById.get(schedule.ownerId)) ? 'btc' : 'candidate';
    };
    const candidateSchedules = schedules.filter(item => effectiveRole(item) === 'candidate' && item.ownerId);
    const hrSchedules = schedules.map(schedule => ({ schedule, account: usersById.get(schedule.ownerId) }))
        .filter(entry => effectiveRole(entry.schedule) === 'btc' && entry.account && (isInterviewStaffUser(entry.account) || entry.account.id === adminUser?.id));
    const pollEvents = existingEvents.filter(event => event.availabilityPollId === poll.id && event.status !== 'cancelled');
    const pollEventsById = new Map(pollEvents.map(event => [event.id, event]));
    // Lịch chốt tay trước đây lưu dấu gửi thư trên scheduledBookings và
    // lastInvitationSentAt trên event, trong khi cron chỉ đọc invitationSentAt
    // của event. Gom cả ba dạng để tuyệt đối không xếp/gửi lại ứng viên đã chốt.
    const scheduledCandidates = new Set();
    pollEvents.forEach(event => {
        if (event.candidateId && (event.invitationSentAt || event.lastInvitationSentAt)) {
            scheduledCandidates.add(event.candidateId);
        }
    });
    bookings.forEach(booking => {
        const event = pollEventsById.get(booking.eventId);
        if (!event || booking.status !== 'confirmed' || !booking.candidateId) return;
        if (booking.invitationSentAt || event.invitationSentAt || event.lastInvitationSentAt) {
            scheduledCandidates.add(booking.candidateId);
        }
    });
    // Một HR không thể bị xếp trùng cùng ca, kể cả giữa hai đợt phỏng vấn khác nhau.
    const occupied = new Set(existingEvents.filter(event => event.status !== 'cancelled' && event.assignedHrId && event.slotId).map(event => `${event.assignedHrId}|${event.slotId}`));
    const pendingByCandidate = new Map(pollEvents.filter(event => event.candidateId && !event.invitationSentAt).map(event => [event.candidateId, event]));
    const pollEnd = addDays(poll.startDate, Number(poll.dayCount || 1) - 1);

    const feasibility = candidateSchedules.filter(candidate => !scheduledCandidates.has(candidate.ownerId)).map(candidate => {
        const account = usersById.get(candidate.ownerId);
        const application = findApplication(candidate, account, applications);
        const forcedAdmin = needsProjectAdmin(application);
        const pendingEvent = pendingByCandidate.get(candidate.ownerId);
        if (pendingEvent) {
            const pendingInfo = slotInfo(pendingEvent.slotId);
            const pendingHr = usersById.get(pendingEvent.assignedHrId);
            return {
                candidate, account, application, forcedAdmin,
                options:pendingInfo && pendingHr ? [{ info:pendingInfo, hr:pendingHr, score:1000, resume:true }] : []
            };
        }
        const candidateSlots = new Set(candidate.slots || []);
        const allowedHrs = forcedAdmin ? hrSchedules.filter(entry => entry.account.id === adminUser?.id) : hrSchedules;
        const options = [];
        allowedHrs.forEach(hrEntry => {
            (hrEntry.schedule.slots || []).forEach(slotId => {
                const info = slotInfo(slotId);
                if (!candidateSlots.has(slotId) || !info || info.dateId < poll.startDate || info.dateId > pollEnd) return;
                if (new Date(slotStartAt(info)).getTime() <= now.getTime()) return;
                if (occupied.has(`${hrEntry.account.id}|${slotId}`)) return;
                const candidatePreferred = (candidate.preferredSlots || []).includes(slotId);
                const hrPreferred = (hrEntry.schedule.preferredSlots || []).includes(slotId);
                options.push({ info, hr:hrEntry.account, candidatePreferred, hrPreferred, score:(candidatePreferred ? 100 : 0) + (hrPreferred ? 70 : 0) });
            });
        });
        options.sort((a, b) => (b.score - a.score) || a.info.id.localeCompare(b.info.id));
        return { candidate, account, application, forcedAdmin, options };
    }).sort((a, b) => a.options.length - b.options.length);

    return feasibility.map(entry => {
        const choice = entry.options.find(option => option.resume || !occupied.has(`${option.hr.id}|${option.info.id}`)) || null;
        if (choice) occupied.add(`${choice.hr.id}|${choice.info.id}`);
        return { ...entry, choice };
    });
}

async function finalizeInterviews(options = {}) {
    const db = options.db || getDb();
    const now = options.now || new Date();
    const today = vnDateId(now);
    const summary = { date:today, polls:0, scheduled:0, pending:0, errors:[] };
    const lockRef = db.collection('automationLocks').doc(`daily-interviews_${today}`);
    let acquired = false;
    await db.runTransaction(async transaction => {
        const lock = await transaction.get(lockRef);
        const data = lock.exists ? lock.data() : null;
        const startedAt = data?.startedAt ? new Date(data.startedAt).getTime() : 0;
        const stale = !startedAt || now.getTime() - startedAt > 30 * 60000;
        if (!data || (data.status !== 'complete' && stale)) {
            transaction.set(lockRef, { status:'running', startedAt:now.toISOString(), date:today });
            acquired = true;
        }
    });
    if (!acquired) return { ...summary, skipped:true, reason:'Đợt chốt 0h hôm nay đã chạy hoặc đang chạy.' };

    const snapshots = await Promise.all([
        db.collection('availabilityPolls').get(), db.collection('meetingSchedules').get(),
        db.collection('users').get(), db.collection('applications').get(),
        db.collection('scheduledEvents').get(), db.collection('scheduledBookings').get()
    ]);
    const rows = snapshot => snapshot.docs.map(doc => ({ id:doc.id, ...doc.data() }));
    const polls = rows(snapshots[0]);
    const allSchedules = rows(snapshots[1]);
    const users = rows(snapshots[2]);
    const applications = rows(snapshots[3]);
    const existingEvents = rows(snapshots[4]);
    const bookings = rows(snapshots[5]);
    for (const poll of polls.filter(item => item.type === 'interview' && item.status === 'open')) {
        const pollEnd = addDays(poll.startDate, Number(poll.dayCount || 1) - 1);
        if (today > pollEnd) {
            await db.collection('availabilityPolls').doc(poll.id).set({ status:'closed', closedAt:now.toISOString(), updatedAt:now.toISOString() }, { merge:true });
            continue;
        }
        summary.polls++;
        const schedules = allSchedules.filter(item => item.pollId === poll.id);
        const plan = buildPlan({ poll, schedules, users, applications, existingEvents, bookings, now });

        for (const item of plan) {
            if (!item.choice || !item.account?.email) { summary.pending++; continue; }
            const candidate = { id:item.account.id, name:item.account.name || item.candidate.name, email:item.account.email };
            const { info, hr } = item.choice;
            const eventId = `auto_${poll.id}_${candidate.id}`.replace(/\//g, '_');
            const eventRef = db.collection('scheduledEvents').doc(eventId);
            try {
                const existing = await eventRef.get();
                let event = existing.exists ? { id:eventId, ...existing.data() } : {
                    id:eventId,
                    title:`${poll.title} — ${info.shift.name} — ${candidate.name}`,
                    type:'interview', startAt:slotStartAt(info), duration:30, capacity:1,
                    slotId:info.id, slotName:info.shift.name, slotTime:info.shift.time,
                    assignedHrId:hr.id, assignedHrName:hr.name || hr.email,
                    candidateId:candidate.id, candidateName:candidate.name, candidateEmail:candidate.email,
                    availabilityPollId:poll.id, availabilityPollTitle:poll.title,
                    generatedFromAvailability:true, autoFinalizedAt:now.toISOString(),
                    specialInterviewer:item.forcedAdmin ? 'project_admin' : null,
                    notes:'Chốt tự động từ phiếu thời gian rảnh lúc 0h Việt Nam.', status:'finalizing',
                    createdBy:'daily-interview-finalizer', createdAt:now.toISOString()
                };
                await eventRef.set(event, { merge:true });
                if (!existing.exists) existingEvents.push(event);
                if (!event.location) {
                    const calendar = await createGoogleMeet(eventId, event, candidate.email, hr.email);
                    event = { ...event, location:calendar.meetLink, googleCalendarEventId:calendar.calendarEventId, googleCalendarHtmlLink:calendar.calendarHtmlLink };
                    await eventRef.set({ location:event.location, googleCalendarEventId:event.googleCalendarEventId, googleCalendarHtmlLink:event.googleCalendarHtmlLink, googleCalendarCreatedAt:now.toISOString() }, { merge:true });
                }
                const bookingId = `${eventId}_${candidate.id}`;
                await db.collection('scheduledBookings').doc(bookingId).set({
                    id:bookingId, eventId, candidateId:candidate.id, candidateName:candidate.name,
                    candidateEmail:candidate.email, status:'confirmed', createdAt:now.toISOString(),
                    confirmedAt:now.toISOString(), confirmedBy:'daily-interview-finalizer'
                }, { merge:true });
                if (!bookings.some(item => item.id === bookingId)) bookings.push({ id:bookingId, eventId, candidateId:candidate.id, status:'confirmed' });
                if (!event.invitationSentAt) {
                    await sendFinalizedInvitation(event, candidate, hr);
                    await eventRef.set({ invitationSentAt:now.toISOString(), status:'confirmed' }, { merge:true });
                }
                summary.scheduled++;
            } catch (error) {
                summary.errors.push({ pollId:poll.id, candidateId:candidate.id, message:error.message });
            }
        }
        await db.collection('availabilityPolls').doc(poll.id).set({
            lastAutoFinalizeAt:now.toISOString(), lastAutoFinalizeDate:today,
            lastAutoFinalizeSummary:{ scheduled:summary.scheduled, pending:summary.pending, errors:summary.errors.length },
            updatedAt:now.toISOString()
        }, { merge:true });
    }
    await lockRef.set({ status:'complete', completedAt:new Date().toISOString(), summary }, { merge:true });
    return summary;
}

module.exports = { SHIFTS, addDays, buildPlan, finalizeInterviews, slotInfo, vnDateId, createGoogleMeet, addGoogleCalendarAttendees };
