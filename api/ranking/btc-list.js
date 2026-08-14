const authHelper = require('../../lib/ynda/auth');

const RANKING_SHEET_ID = process.env.SPREADSHEET_RANKING || '1SgbkoiSXP_zNYWN_AC6WKXTGQPbRAHfs2gwv_NOnsJM';

let CACHE = null;
let CACHE_TIME = 0;
const TTL = 60 * 1000; // 1 minute cache

function normalizeText(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

module.exports = async function getBtcList(req, res) {
  const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://yniemdienanh.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

  try {
    const parseId = (val) => {
      if (val && typeof val === 'string' && val.includes('/spreadsheets/d/')) {
        const match = val.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (match) return match[1];
      }
      return val ? String(val).trim() : '';
    };

    const sid = parseId(req.query.sid) || RANKING_SHEET_ID;

    if (CACHE && Date.now() - CACHE_TIME < TTL && CACHE.sid === sid && CACHE.data && CACHE.data.members && CACHE.data.members.length > 0) {
      return res.json(CACHE.data);
    }

    let rawMembers = [];

    // 1. First attempt: Read directly from Google Sheets (handles both API and GViz CSV)
    try {
      let sheetsApi = null;
      const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT;
      if (serviceAccountKey && serviceAccountKey !== '[SENSITIVE]') {
        const { google } = require('googleapis');
        const { parseServiceAccount } = require('../../lib/googleSheets');
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
      }
      rawMembers = await authHelper.readRankingMembers(sheetsApi, sid);
    } catch (sheetErr) {
      console.warn('[BTC List] Sheet read error:', sheetErr.message);
    }

    // 2. Second attempt: Fallback to Firestore users if sheet read was empty
    if (!rawMembers || rawMembers.length === 0) {
      try {
        const admin = require('firebase-admin');
        if (admin.apps.length) {
          const snap = await admin.firestore().collection('users').get();
          if (!snap.empty) {
            snap.forEach(doc => {
              const d = doc.data();
              const r = String(d.role || '').toLowerCase();
              const pg = String(d.projectGroup || '').toLowerCase();
              const isBtc = r === 'admin' || r === 'organizer' || pg === 'organizer' ||
                /core|vice|truong|pho|head|lead|founder|president|chu tich|sang lap|bdh|btc/i.test(d.position || '') ||
                d.email === 'yniemdienanh@gmail.com';
              if (isBtc) {
                rawMembers.push({
                  name: d.name || 'Thành viên BTC',
                  email: d.email || '',
                  role: r === 'admin' ? 'FOUNDER' : 'CORE',
                  rawRole: d.position || d.leadershipTitle || (r === 'admin' ? 'Quản trị viên' : 'Core Member'),
                  ban: d.dept || 'Ban Điều Hành',
                  department: d.dept || 'Ban Điều Hành',
                  phone: d.phone || '',
                  facebook: d.facebook || '',
                  notes: d.notes || '',
                  tab: 'DATABASE CORE'
                });
              }
            });
          }
        }
      } catch (fsErr) {
        console.warn('[BTC List] Firestore fallback warning:', fsErr.message);
      }
    }

    // 3. Third attempt: Fallback to YNDA Store if still empty
    if (!rawMembers || rawMembers.length === 0) {
      try {
        const ynda = require('../../lib/ynda');
        const users = await ynda.auth.listUsers();
        if (users && users.length) {
          users.forEach(u => {
            const role = String(u.ROLE || '').toUpperCase();
            if (role === 'FOUNDER' || role === 'PRESIDENT' || role === 'CO_FOUNDER' || role === 'CORE' || role === 'VICE') {
              rawMembers.push({
                name: u.NAME,
                email: u.EMAIL,
                role: u.ROLE,
                rawRole: u.ROLE,
                ban: u.DEPARTMENT,
                department: u.DEPARTMENT,
                phone: u.PHONE,
                facebook: '',
                notes: '',
                tab: 'DATABASE CORE'
              });
            }
          });
        }
      } catch (yndaErr) {
        console.warn('[BTC List] YNDA store fallback warning:', yndaErr.message);
      }
    }

    // 4. Guaranteed fallback for standard Admin & Board if no DB is connected
    if (!rawMembers || rawMembers.length === 0) {
      rawMembers = [
        {
          name: 'Ban Tổ Chức · Ý Niệm Điện Ảnh',
          email: 'yniemdienanh@gmail.com',
          role: 'FOUNDER',
          rawRole: 'Sáng lập & Điều hành dự án',
          ban: 'Ban Điều Hành',
          department: 'GLOBAL',
          facebook: 'https://facebook.com/yniemdienanh',
          notes: 'Tài khoản chính thức của Ban Tổ Chức Ý Niệm Điện Ảnh'
        }
      ];
    }

    // Filter BTC & Core members
    const btcMembers = rawMembers.filter(m => {
      const role = String(m.role || '').toUpperCase();
      const rawRole = normalizeText(m.rawRole || '');
      const tab = normalizeText(m.tab || '');
      const email = String(m.email || '').toLowerCase().trim();
      return email === 'yniemdienanh@gmail.com' ||
        role === 'FOUNDER' || role === 'PRESIDENT' || role === 'CO_FOUNDER' || role === 'CORE' || role === 'VICE' ||
        /core|vice|truong|pho|head|lead|founder|president|chu tich|sang lap|bdh|btc|dieu hanh/.test(rawRole) ||
        /core|bdh|btc|dieu hanh/.test(tab);
    });

    // Group members by department
    const departments = {};
    const executives = [];

    btcMembers.forEach(m => {
      const role = String(m.role || '').toUpperCase();
      const rawRole = normalizeText(m.rawRole || '');
      const isExec = m.email === 'yniemdienanh@gmail.com' ||
        role === 'FOUNDER' || role === 'PRESIDENT' || role === 'CO_FOUNDER' ||
        /founder|president|chu tich|sang lap|dong sang lap|admin|giam doc/.test(rawRole);

      const safeMember = {
        name: m.name,
        email: m.email || '',
        role: m.role,
        title: m.rawRole || (isExec ? 'Ban Điều Hành' : 'Core Member'),
        dept: m.ban || m.department || (isExec ? 'Ban Điều Hành' : 'Chung'),
        facebook: m.facebook || '',
        notes: m.notes || '',
        isExecutive: isExec
      };

      if (isExec) {
        executives.push(safeMember);
      }

      const deptName = safeMember.dept || 'Chung';
      if (!departments[deptName]) departments[deptName] = [];
      departments[deptName].push(safeMember);
    });

    const responseData = {
      success: true,
      spreadsheetId: sid,
      updatedAt: new Date().toISOString(),
      totalBtc: btcMembers.length,
      executives,
      departments,
      members: btcMembers.map(m => {
        const role = String(m.role || '').toUpperCase();
        const rawRole = normalizeText(m.rawRole || '');
        const isExec = m.email === 'yniemdienanh@gmail.com' ||
          role === 'FOUNDER' || role === 'PRESIDENT' || role === 'CO_FOUNDER' ||
          /founder|president|chu tich|sang lap|dong sang lap|admin|giam doc/.test(rawRole);
        return {
          name: m.name,
          email: m.email || '',
          role: m.role,
          title: m.rawRole || '',
          dept: m.ban || m.department || '',
          facebook: m.facebook || '',
          notes: m.notes || '',
          isExecutive: isExec
        };
      })
    };

    CACHE = { sid, time: Date.now(), data: responseData };
    return res.json(responseData);
  } catch (error) {
    console.error('[BTC List] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
