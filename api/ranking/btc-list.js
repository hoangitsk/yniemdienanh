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

function formatProperTitle(role, rawRole, ban) {
  const r = String(role || '').toUpperCase();
  const raw = String(rawRole || '').trim();
  const b = String(ban || '').trim();

  if (r === 'FOUNDER') return raw || 'Sáng lập / Founder';
  if (r === 'CO_FOUNDER') return raw || 'Đồng sáng lập / Co-founder';
  if (r === 'PRESIDENT') return raw || 'Chủ tịch / President';
  if (r === 'CORE') {
    if (raw && !/member|thanh vien/i.test(raw)) return raw;
    return b ? `Trưởng Ban ${b}` : 'Trưởng Ban';
  }
  if (r === 'VICE') {
    if (raw && !/member|thanh vien/i.test(raw)) return raw;
    return b ? `Phó Ban ${b}` : 'Phó Ban';
  }
  if (r === 'MEMBER') {
    return b ? `Thành viên Ban ${b}` : (raw || 'Thành viên');
  }
  return raw || (b ? `Thành viên Ban ${b}` : 'Thành viên');
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
              const lt = String(d.leadershipTitle || '').toLowerCase();
              let mappedRole = 'MEMBER';
              if (r === 'admin' || lt === 'founder' || lt === 'president' || lt === 'cofounder') {
                mappedRole = lt === 'founder' ? 'FOUNDER' : lt === 'cofounder' ? 'CO_FOUNDER' : 'PRESIDENT';
              } else if (r === 'organizer' || lt === 'core' || lt === 'vice') {
                mappedRole = lt === 'vice' ? 'VICE' : 'CORE';
              }
              rawMembers.push({
                name: d.name || 'Thành viên',
                email: d.email || '',
                role: mappedRole,
                rawRole: d.position || d.leadershipTitle || '',
                ban: d.dept || '',
                department: d.dept || '',
                phone: d.phone || '',
                facebook: d.facebook || '',
                notes: d.notes || '',
                tab: mappedRole === 'MEMBER' ? 'DATABASE THÀNH VIÊN' : 'DATABASE CORE'
              });
            });
          }
        }
      } catch (fsErr) {
        console.warn('[BTC List] Firestore fallback warning:', fsErr.message);
      }
    }

    // Process & classify all members
    const executives = [];
    const leads = [];
    const departments = {};

    const formattedMembers = rawMembers.map(m => {
      const roleUpper = String(m.role || '').toUpperCase();
      const rawRoleNorm = normalizeText(m.rawRole || '');
      const banName = m.ban || m.department || (roleUpper === 'FOUNDER' || roleUpper === 'PRESIDENT' || roleUpper === 'CO_FOUNDER' ? 'Ban Điều Hành' : 'Thành viên');
      
      const isExec = m.email === 'yniemdienanh@gmail.com' ||
        roleUpper === 'FOUNDER' || roleUpper === 'PRESIDENT' || roleUpper === 'CO_FOUNDER' ||
        /founder|president|chu tich|sang lap|dong sang lap/.test(rawRoleNorm);

      const isLead = !isExec && (roleUpper === 'CORE' || roleUpper === 'VICE' || /truong|pho|head|lead|core|vice/.test(rawRoleNorm));
      const isBtc = isExec || isLead;

      const title = formatProperTitle(roleUpper, m.rawRole, banName);

      const memberObj = {
        name: m.name,
        email: m.email || '',
        role: roleUpper,
        rawRole: m.rawRole || '',
        title: title,
        dept: banName,
        facebook: m.facebook || '',
        phone: m.phone || '',
        notes: m.notes || '',
        school: m.school || '',
        address: m.address || '',
        gender: m.gender || '',
        dob: m.dob || '',
        isExecutive: isExec,
        isLead: isLead,
        isBtc: isBtc,
        category: isExec ? 'exec' : isLead ? 'lead' : 'member',
        tab: m.tab || ''
      };

      if (isExec) {
        executives.push(memberObj);
      } else if (isLead) {
        leads.push(memberObj);
      }

      const dKey = banName || 'Khác';
      if (!departments[dKey]) {
        departments[dKey] = {
          name: dKey,
          leads: [],
          members: [],
          all: []
        };
      }
      departments[dKey].all.push(memberObj);
      if (isLead || isExec) {
        departments[dKey].leads.push(memberObj);
      } else {
        departments[dKey].members.push(memberObj);
      }

      return memberObj;
    });

    const btcCount = formattedMembers.filter(m => m.isBtc).length;
    const memberCount = formattedMembers.filter(m => !m.isBtc).length;

    const responseData = {
      success: true,
      spreadsheetId: sid,
      updatedAt: new Date().toISOString(),
      totalMembers: formattedMembers.length,
      totalBtc: btcCount,
      totalCommunityMembers: memberCount,
      executives,
      leads,
      departments,
      members: formattedMembers
    };

    CACHE = { sid, time: Date.now(), data: responseData };
    return res.json(responseData);
  } catch (error) {
    console.error('[BTC List] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
