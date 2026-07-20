const admin = require('firebase-admin');
const { isScheduleManager } = require('../../lib/schedulePermissions');
const { addGoogleCalendarAttendees } = require('../../lib/interviewFinalizer');
const { preferredSender, sendMailWithFallback } = require('../../lib/mailer');

function getDb() {
    if (!admin.apps.length) {
        let raw = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT chưa được cấu hình.');
        raw = raw.trim().replace(/^"|"$/g, '');
        let account = JSON.parse(raw);
        if (typeof account === 'string') account = JSON.parse(account);
        if (account.private_key) account.private_key = account.private_key.replace(/\\n/g, '\n');
        admin.initializeApp({ credential:admin.credential.cert(account) });
    }
    return admin.firestore();
}

function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function eligibleInterviewer(profile) {
    if (normalize(profile && profile.projectGroup) === 'candidate') return false;
    const role = normalize(profile && profile.role);
    const context = normalize([profile && profile.position, profile && profile.title, profile && profile.leadershipTitle].filter(Boolean).join(' '));
    const email = normalize(profile && profile.email);
    return email === 'yniemdienanh@gmail.com' || ['admin', 'organizer', 'president', 'core'].includes(role) ||
        context.includes('core') || context.includes('president') || context.includes('chu tich') || context.includes('ban dieu hanh');
}

function interval(event) {
    const start = new Date(event.startAt).getTime();
    return { start, end:start + Math.max(1, Number(event.duration || 30)) * 60000 };
}

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
}

module.exports = async function reassignInterviewer(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error:'Method not allowed' });
    try {
        const body = req.body || {};
        if (!body.idToken || !body.eventId || !body.interviewerId) return res.status(400).json({ error:'Thiếu lịch hoặc người phỏng vấn mới.' });
        const db = getDb();
        const decoded = await admin.auth().verifyIdToken(body.idToken);
        const operatorDoc = await db.collection('users').doc(decoded.uid).get();
        const operator = operatorDoc.exists ? operatorDoc.data() : {};
        if (!decoded.email_verified || !isScheduleManager(decoded, operator)) return res.status(403).json({ error:'Bạn không có quyền đổi người phỏng vấn.' });

        // Retrieve interviewer from Firebase Auth and applications in case their Firestore profile doc does not exist yet.
        let interviewerAuth = null;
        let interviewerApp = null;
        try {
            interviewerAuth = await admin.auth().getUser(String(body.interviewerId)).catch(err => {
                console.warn(`Interviewer Auth fetch failed for ID ${body.interviewerId}:`, err);
                return null;
            });
            if (interviewerAuth && interviewerAuth.email) {
                const appSnap = await db.collection('applications')
                    .where('email', '==', String(interviewerAuth.email).trim().toLowerCase())
                    .limit(1)
                    .get();
                if (!appSnap.empty) {
                    interviewerApp = appSnap.docs[0].data();
                }
            }
        } catch (authErr) {
            console.warn('Auth/App fetch error:', authErr);
        }

        const eventRef = db.collection('scheduledEvents').doc(String(body.eventId));
        const interviewerRef = db.collection('users').doc(String(body.interviewerId));
        const auditRef = db.collection('auditLogs').doc();
        let event;
        let interviewer;
        let oldInterviewerEmail = '';
        const now = new Date().toISOString();

        await db.runTransaction(async tx => {
            const [eventDoc, interviewerDoc, eventsSnap] = await Promise.all([
                tx.get(eventRef), tx.get(interviewerRef), tx.get(db.collection('scheduledEvents'))
            ]);
            if (!eventDoc.exists || (!interviewerDoc.exists && !interviewerAuth)) {
                throw new Error('Không tìm thấy lịch hoặc tài khoản người phỏng vấn.');
            }
            event = { id:eventDoc.id, ...eventDoc.data() };
            interviewer = interviewerDoc.exists ? { id:interviewerDoc.id, ...interviewerDoc.data() } : {
                id: String(body.interviewerId),
                name: interviewerAuth ? (interviewerAuth.displayName || interviewerAuth.email.split('@')[0]) : '',
                email: interviewerAuth ? interviewerAuth.email : '',
                role: String(interviewerAuth && interviewerAuth.email || '').toLowerCase() === 'yniemdienanh@gmail.com' ? 'admin' : 'member',
                dept: interviewerApp ? (interviewerApp.dept || '') : '',
                position: interviewerApp ? (interviewerApp.position || '') : ''
            };

            // Initialize Firestore profile if it did not exist
            if (!interviewerDoc.exists) {
                tx.set(interviewerRef, {
                    name: interviewer.name,
                    email: interviewer.email,
                    role: interviewer.role,
                    dept: interviewer.dept,
                    position: interviewer.position,
                    createdAt: now,
                    updatedAt: now
                }, { merge:true });
            }
            if ((event.type !== 'interview' && event.type !== 'meeting') || event.status === 'cancelled') {
                throw new Error('Lịch này không thể đổi người phụ trách.');
            }
            if (!interviewer.email || (event.type === 'interview' && !eligibleInterviewer(interviewer))) {
                throw new Error(event.type === 'interview' ? 'Chỉ Admin/Core/President hợp lệ mới được phân công phỏng vấn.' : 'Người được phân công chưa có email.');
            }
            const wanted = interval(event);
            const conflict = eventsSnap.docs.map(doc => ({ id:doc.id, ...doc.data() })).some(item => {
                if (item.id === event.id || item.status === 'cancelled' || String(item.assignedHrId || '') !== interviewer.id) return false;
                const existing = interval(item);
                return Number.isFinite(existing.start) && wanted.start < existing.end && wanted.end > existing.start;
            });
            if (conflict) throw new Error('Người phỏng vấn mới đã có lịch khác trùng giờ.');
            oldInterviewerEmail = String(event.assignedHrEmail || '').trim().toLowerCase();
            tx.set(eventRef, {
                assignedHrId:interviewer.id, assignedHrName:interviewer.name || interviewer.email,
                assignedHrEmail:interviewer.email, assignedHrRole:interviewer.role || '',
                assignedHrDept:interviewer.dept || '', assignedHrPosition:interviewer.position || interviewer.title || '',
                reassignedAt:now, reassignedBy:decoded.uid, updatedAt:now, updatedBy:decoded.uid
            }, { merge:true });
            tx.set(auditRef, { actorId:decoded.uid, actorRole:operator.role || 'schedule_manager', action:'INTERVIEWER_REASSIGNED', entityType:'scheduledEvent', entityId:event.id,
                oldValue:{ interviewerId:event.assignedHrId || '', interviewerEmail:oldInterviewerEmail },
                newValue:{ interviewerId:interviewer.id, interviewerEmail:interviewer.email }, reason:'Đổi người phỏng vấn theo phân công.', createdAt:now });
        });

        const adminSnap = await db.collection('users').where('role', '==', 'admin').get();
        const adminEmails = adminSnap.docs.map(doc => String((doc.data() || {}).email || '').trim().toLowerCase()).filter(Boolean);
        let calendarWarning = '';
        if (event.googleCalendarEventId) {
            try {
                await addGoogleCalendarAttendees(event, event.candidateEmail || '', interviewer.email, adminEmails, oldInterviewerEmail ? [oldInterviewerEmail] : []);
            } catch (calendarError) {
                calendarWarning = calendarError.message || 'Không cập nhật được Google Calendar.';
            }
        }

        const sender = preferredSender('brevo');
        const time = new Date(event.startAt).toLocaleString('vi-VN', { dateStyle:'full', timeStyle:'short', timeZone:'Asia/Ho_Chi_Minh' });
        const attendeeName = escapeHtml(event.candidateName || 'thành viên');
        const meet = escapeHtml(event.location || 'Link Meet sẽ được bổ sung sau');
        let emailSent = false;
        let emailWarning = '';
        if (!sender) {
            emailWarning = 'Chưa cấu hình kênh gửi email.';
        } else {
            try {
                const isInterview = event.type === 'interview';
                const subject = isInterview
                    ? '[Người phỏng vấn] Bạn được phân công phỏng vấn — ' + (event.title || attendeeName)
                    : '[Lịch họp] Bạn được phân công phụ trách cuộc họp — ' + (event.title || attendeeName);
                const html = isInterview
                    ? '<div style="max-width:600px;margin:auto;padding:28px;font-family:Arial,sans-serif;line-height:1.65;color:#1f2937"><p>Chào ' + escapeHtml(interviewer.name || interviewer.email) + ',</p><p>Bạn vừa được phân công phỏng vấn <strong>' + attendeeName + '</strong>.</p><p><strong>Ban ứng tuyển:</strong> ' + escapeHtml(event.candidateDepartment || 'Chưa cập nhật') + '<br><strong>Chức danh ứng tuyển:</strong> ' + escapeHtml(event.candidatePosition || 'Chưa cập nhật') + '<br><strong>Thời gian:</strong> ' + escapeHtml(time) + '<br><strong>Google Meet:</strong> ' + (event.location ? '<a href="' + meet + '">' + meet + '</a>' : meet) + '</p><p>Vui lòng kiểm tra lịch phân công trước buổi phỏng vấn.</p></div>'
                    : '<div style="max-width:600px;margin:auto;padding:28px;font-family:Arial,sans-serif;line-height:1.65;color:#1f2937"><p>Chào ' + escapeHtml(interviewer.name || interviewer.email) + ',</p><p>Bạn vừa được phân công phụ trách cuộc họp <strong>' + (event.title || 'Họp') + '</strong> cùng <strong>' + attendeeName + '</strong>.</p><p><strong>Thời gian:</strong> ' + escapeHtml(time) + '<br><strong>Google Meet:</strong> ' + (event.location ? '<a href="' + meet + '">' + meet + '</a>' : meet) + '</p><p>Vui lòng kiểm tra lịch phân công trước giờ họp.</p></div>';

                await sendMailWithFallback({
                    to:String(interviewer.email).trim().toLowerCase(),
                    subject:subject,
                    html:html
                }, { fromName:sender.name, preferredProvider:'brevo' });
                emailSent = true;
                await eventRef.set({ reassignmentEmailSentAt:new Date().toISOString(), reassignmentEmailRecipient:String(interviewer.email).trim().toLowerCase() }, { merge:true });
            } catch (emailError) {
                emailWarning = emailError.message || 'Không gửi được email phân công.';
            }
        }
        return res.status(200).json({ success:true, emailSent, warning:[calendarWarning, emailWarning].filter(Boolean).join(' '), eventId:event.id, interviewer:{ id:interviewer.id, name:interviewer.name || interviewer.email, email:interviewer.email } });
    } catch (error) {
        console.error('Reassign interviewer error:', error);
        return res.status(error.code === 'auth/id-token-expired' ? 401 : 409).json({ error:error.message || 'Không thể đổi người phỏng vấn.' });
    }
};
