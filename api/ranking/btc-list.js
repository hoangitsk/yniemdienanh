const { getRows } = require('../../lib/googleSheets');
const authHelper = require('../../lib/ynda/auth');

const RANKING_SHEET_ID = process.env.SPREADSHEET_RANKING || '1SgbkoiSXP_zNYWN_AC6WKXTGQPbRAHfs2gwv_NOnsJM';

let CACHE = null;
let CACHE_TIME = 0;
const TTL = 60 * 1000; // 1 minute cache

module.exports = async function getBtcList(req, res) {
  try {
    const parseId = (val) => {
      if (val && typeof val === 'string' && val.includes('/spreadsheets/d/')) {
        const match = val.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (match) return match[1];
      }
      return val ? String(val).trim() : '';
    };

    const sid = parseId(req.query.sid) || RANKING_SHEET_ID;

    if (CACHE && Date.now() - CACHE_TIME < TTL && CACHE.sid === sid) {
      return res.json(CACHE.data);
    }

    const { google } = require('googleapis');
    const { parseServiceAccount } = require('../../lib/googleSheets');
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT;
    
    let members = [];
    if (serviceAccountKey) {
      const credentials = parseServiceAccount(serviceAccountKey);
      const authClient = new google.auth.JWT(
        credentials.client_email,
        null,
        credentials.private_key,
        ['https://www.googleapis.com/auth/spreadsheets.readonly']
      );
      const sheetsApi = google.sheets({ version: 'v4', auth: authClient });
      members = await authHelper.readRankingMembers(sheetsApi);
    }

    // Filter BTC & Core members
    const btcMembers = members.filter(m => {
      const role = String(m.role || '').toUpperCase();
      const rawRole = String(m.rawRole || '').toLowerCase();
      const tab = String(m.tab || '').toLowerCase();
      return role === 'FOUNDER' || role === 'PRESIDENT' || role === 'CO_FOUNDER' || role === 'CORE' || role === 'VICE' ||
        /core|vice|truong|pho|head|lead|founder|president|chu tich|sang lap|bdh|btc|dieu hanh/i.test(rawRole) ||
        /core|bdh|btc|dieu hanh/i.test(tab);
    });

    // Group members by department
    const departments = {};
    const executives = [];

    btcMembers.forEach(m => {
      const role = String(m.role || '').toUpperCase();
      const rawRole = String(m.rawRole || '').toLowerCase();
      const isExec = role === 'FOUNDER' || role === 'PRESIDENT' || role === 'CO_FOUNDER' ||
        /founder|president|chu tich|sang lap|dong sang lap|admin|giam doc/i.test(rawRole);

      const safeMember = {
        name: m.name,
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
      members: btcMembers.map(m => ({
        name: m.name,
        role: m.role,
        title: m.rawRole || '',
        dept: m.ban || m.department || '',
        facebook: m.facebook || '',
        notes: m.notes || '',
        isExecutive: m.role === 'FOUNDER' || m.role === 'PRESIDENT' || m.role === 'CO_FOUNDER'
      }))
    };

    CACHE = { sid, time: Date.now(), data: responseData };
    return res.json(responseData);
  } catch (error) {
    console.error('[BTC List] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
