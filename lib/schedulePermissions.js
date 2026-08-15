function normalize(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function profileContext(profile) {
    return [profile && profile.dept, profile && profile.position, profile && profile.title, profile && profile.leadershipTitle]
        .map(normalize)
        .filter(Boolean)
        .join(' ');
}

function isHrOrPr(profile) {
    const context = profileContext(profile);
    return context.includes('nhan su') || context.includes('hr') ||
        context.includes('truyen thong') || context.includes('pr') ||
        context.includes('marketing') || context.includes('mkt');
}

function isHr(profile) {
    const context = profileContext(profile);
    return context.includes('nhan su') || context.includes('hr');
}

function isLeadershipRole(role) {
    return ['admin', 'organizer', 'founder', 'president', 'core_founder', 'co_founder', 'core', 'vice', 'leader', 'truong ban', 'pho ban'].includes(normalize(role));
}

function isPeopleManager(decoded, profile) {
    const email = normalize(decoded && decoded.email);
    if (email === 'yniemdienanh@gmail.com') return true;
    if (normalize(profile && profile.projectGroup) === 'candidate') return false;
    const role = normalize(profile && profile.role);
    if (isLeadershipRole(role)) return true;
    const context = profileContext(profile);
    if (context.includes('core') || context.includes('ban dieu hanh') || context.includes('chu tich') ||
        context.includes('truong') || context.includes('pho') || context.includes('lead') || context.includes('head')) return true;
    return isHrOrPr(profile);
}

function isScheduleManager(decoded, profile) {
    const email = normalize(decoded && decoded.email);
    if (email === 'yniemdienanh@gmail.com') return true;
    if (normalize(profile && profile.projectGroup) === 'candidate') return false;
    const role = normalize(profile && profile.role);
    if (isLeadershipRole(role)) return true;
    const context = profileContext(profile);
    if (context.includes('core') || context.includes('ban dieu hanh') || context.includes('chu tich') ||
        context.includes('truong') || context.includes('pho') || context.includes('lead') || context.includes('head')) return true;
    return isHrOrPr(profile);
}

function isScoreManager(decoded, profile) {
    if (isPeopleManager(decoded, profile)) return true;
    const role = normalize(profile && profile.role);
    if (['president', 'founder', 'core', 'vice', 'leader'].includes(role)) return true;
    const context = profileContext(profile);
    return context.includes('ban dieu hanh') || context.includes('chu tich') ||
        context.includes('truong') || context.includes('pho') || context.includes('vice') ||
        context.includes('core') || context.includes('head') || context.includes('lead');
}

function isInterviewStaff(decoded, profile) {
    if (normalize(profile && profile.projectGroup) === 'candidate') return false;
    const role = normalize(profile && profile.role);
    const position = normalize(profile && profile.position);
    const title = normalize(profile && profile.title);
    const context = profileContext(profile);
    return isScheduleManager(decoded, profile) || ['president', 'founder', 'core', 'vice'].includes(role) ||
        context.includes('ban dieu hanh') || context.includes('chu tich') ||
        position === 'president' || title === 'president' || position === 'core' || title === 'core';
}

module.exports = { normalize, profileContext, isHrOrPr, isHr, isLeadershipRole, isPeopleManager, isScheduleManager, isScoreManager, isInterviewStaff };
