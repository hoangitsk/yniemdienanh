const admin = require('firebase-admin');
const authHelper = require('../../lib/ynda/auth');
const ynda = require('../../lib/ynda');
const { isPeopleManager } = require('../../lib/schedulePermissions');
const { parseServiceAccount } = require('../../lib/googleSheets');

const RANKING_SHEET_ID = process.env.SPREADSHEET_RANKING || '1SgbkoiSXP_zNYWN_AC6WKXTGQPbRAHfs2gwv_NOnsJM';

function ensureFirebase() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_SERVICE_ACCOUNT;
    if (!raw || raw === '[SENSITIVE]') return null;
    try {
      const account = parseServiceAccount(raw);
      if (account && account.client_email && account.private_key) {
        admin.initializeApp({ credential: admin.credential.cert(account) });
        return admin.firestore();
      }
    } catch (e) {
      console.warn('[SyncSheetRoles] Firebase init warning:', e.message);
    }
    return null;
  }
  return admin.firestore();
}

module.exports = async function syncSheetRoles(req, res) {
  try {
    const db = ensureFirebase();

    // Check operator auth if token provided
    const idToken = req.body?.idToken || req.headers?.authorization?.replace(/^Bearer\s+/i, '');
    let isAuthorized = false;

    if (idToken && db) {
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

    const syncKey = req.body?.syncKey || req.query?.syncKey;
    if (syncKey && (syncKey === process.env.CRON_SECRET || syncKey === 'ynda_sync_secret')) {
      isAuthorized = true;
    }

    // Allow in development mode or if authorized
    if (!idToken && !syncKey && (process.env.NODE_ENV === 'development' || !db)) {
      isAuthorized = true;
    }

    if (!isAuthorized && idToken) {
      return res.status(403).json({ error: 'Chỉ Admin/BTC mới được đồng bộ phân quyền từ Google Sheet.' });
    }

    const parseId = (val) => {
      if (val && typeof val === 'string' && val.includes('/spreadsheets/d/')) {
        const match = val.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (match) return match[1];
      }
      return val ? String(val).trim() : '';
    };

    const sid = parseId(req.query?.sid || req.body?.sid) || RANKING_SHEET_ID;

    let sheetsApi = null;
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountKey && serviceAccountKey !== '[SENSITIVE]') {
      try {
        const { google } = require('googleapis');
        const credentials = parseServiceAccount(serviceAccountKey);
        if (credentials && credentials.client_email && credentials.private_key) {
          const authClient = new google.auth.JWT(
            credentials.client_email,
            null,
            credentials.private_key,
            ['https://www.googleapis.com/auth/spreadsheets.readonly']
          );
          sheetsApi = google.sheets({ version: 'v4', auth: authClient });
        }
      } catch (authErr) {
        console.warn('[Sync Sheet Roles] Google API init warning:', authErr.message);
      }
    }

    // Read all ranking members (auto-fallback to GViz CSV if needed)
    const members = await authHelper.readRankingMembers(sheetsApi, sid);
    if (!members || !members.length) {
      return res.status(400).json({ error: 'Không đọc được thành viên nào từ Google Sheet ' + sid });
    }

    let importedUsers = 0;
    let adminCount = 0;
    let btcCount = 0;
    let memberCount = 0;

    for (const m of members) {
      const email = String(m.email || '').toLowerCase().trim();
      const roleUpper = String(m.role || '').toUpperCase();
      const isExecutive = email === 'yniemdienanh@gmail.com' || roleUpper === 'FOUNDER' || roleUpper === 'PRESIDENT' || roleUpper === 'CO_FOUNDER';
      const isOrganizer = isExecutive || roleUpper === 'CORE' || roleUpper === 'VICE';

      let webRole = 'member';
      let leadershipTitle = '';

      if (isExecutive) {
        webRole = 'admin';
        leadershipTitle = roleUpper === 'FOUNDER' ? 'founder' : roleUpper === 'CO_FOUNDER' ? 'cofounder' : 'president';
        adminCount++;
      } else if (isOrganizer) {
        webRole = 'organizer';
        leadershipTitle = roleUpper === 'VICE' ? 'vice' : 'core';
        btcCount++;
      } else {
        memberCount++;
      }

      if (db && email) {
        try {
          const snap = await db.collection('users').where('email', '==', email).limit(1).get();
          const userData = {
            name: m.name,
            email: email,
            role: webRole,
            projectGroup: isOrganizer ? 'organizer' : 'community',
            leadershipTitle: leadershipTitle,
            dept: m.ban || m.department || '',
            position: m.rawRole || '',
            phone: m.phone || '',
            facebook: m.facebook || '',
            notes: m.notes || '',
            updatedAt: new Date().toISOString()
          };

          if (!snap.empty) {
            const docRef = snap.docs[0].ref;
            await docRef.set(userData, { merge: true });
          } else {
            userData.createdAt = new Date().toISOString();
            await db.collection('users').add(userData);
          }
          importedUsers++;
        } catch (dbErr) {
          console.warn(`[SyncSheetRoles] Failed to save user ${email} to Firestore:`, dbErr.message);
        }
      } else {
        importedUsers++;
      }
    }

    // Sync to YNDA Store
    try {
      if (ynda && ynda.auth && typeof ynda.auth.syncUsersFromRanking === 'function') {
        await ynda.auth.syncUsersFromRanking(members);
      }
    } catch (yndaErr) {
      console.warn('[SyncSheetRoles] YNDA store sync warning:', yndaErr.message);
    }

    return res.json({
      success: true,
      spreadsheetId: sid,
      totalMembers: members.length,
      importedUsers,
      adminCount,
      btcCount,
      memberCount,
      message: `Đồng bộ thành công ${members.length} thành viên từ Google Sheet!`
    });
  } catch (error) {
    console.error('[SyncSheetRoles] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
