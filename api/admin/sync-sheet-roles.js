const admin = require('firebase-admin');
const authHelper = require('../../lib/ynda/auth');
const ynda = require('../../lib/ynda');
const { isPeopleManager } = require('../../lib/schedulePermissions');

const RANKING_SHEET_ID = process.env.SPREADSHEET_RANKING || '1SgbkoiSXP_zNYWN_AC6WKXTGQPbRAHfs2gwv_NOnsJM';

function ensureFirebase() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT chưa được cấu hình.');
    let account = JSON.parse(raw.trim().replace(/^"|"$/g, ''));
    if (typeof account === 'string') account = JSON.parse(account);
    if (account.private_key) account.private_key = account.private_key.replace(/\\n/g, '\n');
    admin.initializeApp({ credential: admin.credential.cert(account) });
  }
  return admin.firestore();
}

module.exports = async function syncSheetRoles(req, res) {
  try {
    const db = ensureFirebase();

    // Check operator auth if token provided
    const idToken = req.body?.idToken || req.headers?.authorization?.replace(/^Bearer\s+/i, '');
    let isAuthorized = false;

    if (idToken) {
      try {
        const decoded = await admin.auth().verifyIdToken(idToken);
        const userDoc = await db.collection('users').doc(decoded.uid).get();
        const profile = userDoc.exists ? userDoc.data() : {};
        if (decoded.email === 'yniemdienanh@gmail.com' || isPeopleManager(decoded, profile)) {
          isAuthorized = true;
        }
      } catch (authErr) {
        console.warn('[SyncSheetRoles] Token check failed:', authErr.message);
      }
    }

    // Also accept sync key if configured
    const syncKey = req.query?.key || req.body?.key;
    if (process.env.SYNC_ADMIN_KEY && syncKey === process.env.SYNC_ADMIN_KEY) {
      isAuthorized = true;
    }

    // Default allow for project admin or internal calls
    if (!idToken && !syncKey && process.env.NODE_ENV === 'development') {
      isAuthorized = true;
    }

    if (!isAuthorized && idToken) {
      return res.status(403).json({ error: 'Chỉ Admin/BTC mới được đồng bộ phân quyền từ Google Sheet.' });
    }

    const { google } = require('googleapis');
    const { parseServiceAccount } = require('../../lib/googleSheets');
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountKey) {
      return res.status(503).json({ error: 'GOOGLE_SERVICE_ACCOUNT hoặc FIREBASE_SERVICE_ACCOUNT chưa được cấu hình trên máy chủ.' });
    }

    const credentials = parseServiceAccount(serviceAccountKey);
    const authClient = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      ['https://www.googleapis.com/auth/spreadsheets.readonly']
    );
    const sheetsApi = google.sheets({ version: 'v4', auth: authClient });

    // Read all ranking members
    const members = await authHelper.readRankingMembers(sheetsApi);
    if (!members || !members.length) {
      return res.status(400).json({ error: 'Không đọc được thành viên nào từ Google Sheet ' + RANKING_SHEET_ID });
    }

    let importedUsers = 0;
    let adminCount = 0;
    let btcCount = 0;
    let memberCount = 0;
    const syncedList = [];

    for (const m of members) {
      if (!m.email || !m.email.includes('@')) continue;
      const email = m.email.trim().toLowerCase();
      const userSnap = await db.collection('users').where('email', '==', email).limit(1).get();
      const existingUser = userSnap.empty ? null : { id: userSnap.docs[0].id, ...userSnap.docs[0].data() };

      const isFounderOrAdmin = email === 'yniemdienanh@gmail.com' ||
        m.role === 'FOUNDER' || m.role === 'PRESIDENT' || m.role === 'CO_FOUNDER' ||
        /founder|sang lap|president|chu tich|admin|quan tri|giam doc/i.test(m.rawRole || '');

      const isBtcOrCore = isFounderOrAdmin ||
        m.role === 'CORE' || m.role === 'VICE' ||
        /core|vice|pho ban|truong ban|head|lead|leader|bdh|btc|dieu hanh/i.test(m.rawRole || '') ||
        /core|bdh|btc|dieu hanh/i.test(m.tab || '');

      const finalRole = isFounderOrAdmin ? 'admin' : (isBtcOrCore ? 'organizer' : 'member');
      const projectGroup = (isFounderOrAdmin || isBtcOrCore) ? 'organizer' : 'community';
      const leadershipTitle = isFounderOrAdmin ? (m.role === 'PRESIDENT' ? 'president' : 'founder') : (isBtcOrCore ? (m.role === 'VICE' ? 'vice' : 'core') : '');

      if (finalRole === 'admin') adminCount++;
      else if (finalRole === 'organizer') btcCount++;
      else memberCount++;

      const userData = {
        dept: m.ban || m.department || '',
        name: m.name || '',
        position: m.rawRole || (finalRole === 'admin' ? 'Quản trị viên' : (finalRole === 'organizer' ? 'Ban Tổ Chức' : 'Thành viên')),
        gender: m.gender || '',
        dob: m.dob || '',
        address: m.address || '',
        school: m.school || '',
        email: email,
        phone: m.phone || '',
        facebook: m.facebook || '',
        notes: m.notes || '',
        role: finalRole,
        projectGroup,
        leadershipTitle,
        updatedAt: new Date().toISOString()
      };

      if (existingUser) {
        userData.createdAt = existingUser.createdAt || new Date().toISOString();
        await db.collection('users').doc(existingUser.id).set(userData, { merge: true });
      } else {
        await db.collection('users').add({ ...userData, createdAt: new Date().toISOString() });
      }

      syncedList.push({ name: m.name, email, role: finalRole, dept: userData.dept, position: userData.position });
      importedUsers++;
    }

    // Sync to YNDA ops store as well
    let yndaSyncReport = null;
    try {
      yndaSyncReport = await authHelper.syncUsersFromRanking(members);
    } catch (yndaErr) {
      console.warn('[SyncSheetRoles] YNDA store sync warning:', yndaErr.message);
    }

    return res.json({
      success: true,
      spreadsheetId: RANKING_SHEET_ID,
      importedUsers,
      adminCount,
      btcCount,
      memberCount,
      total: members.length,
      yndaSync: yndaSyncReport,
      syncedList
    });
  } catch (error) {
    console.error('[SyncSheetRoles] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
