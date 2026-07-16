function normalize(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function profileContext(profile) {
    return [profile && profile.dept, profile && profile.position, profile && profile.title]
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
    return email === 'yniemdienanh@gmail.com' || ['admin', 'organizer'].includes(role) || isHrOrPr(profile);
}

function isScheduleManager(decoded, profile) {
    const email = normalize(decoded && decoded.email);
    const role = normalize(profile && profile.role);
    return email === 'yniemdienanh@gmail.com' ||
        ['admin', 'organizer'].includes(role) || isHrOrPr(profile);
}

function isInterviewStaff(decoded, profile) {
    const role = normalize(profile && profile.role);
    const context = profileContext(profile);
    return isScheduleManager(decoded, profile) || ['president', 'core'].includes(role) ||
        context.includes('ban dieu hanh') || context.includes('chu tich') ||
        context.includes('president') || context.includes('core');
}

module.exports = { normalize, profileContext, isHrOrPr, isHr, isPeopleManager, isScheduleManager, isInterviewStaff };
