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

function isPeopleManager(decoded, profile) {
    const email = normalize(decoded && decoded.email);
    const role = normalize(profile && profile.role);
    if (email === 'yniemdienanh@gmail.com') return true;
    if (normalize(profile && profile.projectGroup) === 'candidate') return false;
    return ['admin', 'organizer'].includes(role) || isHrOrPr(profile);
}

function isLeadershipRole(role) {
    return ['admin', 'organizer', 'president', 'core'].includes(normalize(role));
}

function isScheduleManager(decoded, profile) {
    const email = normalize(decoded && decoded.email);
    const role = normalize(profile && profile.role);
    if (email === 'yniemdienanh@gmail.com') return true;
    if (normalize(profile && profile.projectGroup) === 'candidate') return false;
    return ['admin', 'organizer'].includes(role) || isHrOrPr(profile);
}

function isInterviewStaff(decoded, profile) {
    if (normalize(profile && profile.projectGroup) === 'candidate') return false;
    const role = normalize(profile && profile.role);
    const position = normalize(profile && profile.position);
    const title = normalize(profile && profile.title);
    const context = profileContext(profile);
    return isScheduleManager(decoded, profile) || ['president', 'core'].includes(role) ||
        context.includes('ban dieu hanh') || context.includes('chu tich') ||
        position === 'president' || title === 'president' || position === 'core' || title === 'core';
}

module.exports = { normalize, profileContext, isHrOrPr, isHr, isLeadershipRole, isPeopleManager, isScheduleManager, isInterviewStaff };
