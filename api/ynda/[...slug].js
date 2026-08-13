'use strict';

// =============================================================================
// YNDA SERVERLESS CATCH-ALL (Vercel) — /api/ynda/* dành cho các sub-route
// Vercel map: api/ynda/[...slug].js -> mọi subpath dưới /api/ynda/
// Cron /api/ynda/cron/tick được chuyển cho api/cron/ynda-cron.
// =============================================================================

module.exports = require('./index');