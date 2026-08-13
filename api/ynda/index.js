'use strict';

// =============================================================================
// YNDA SERVERLESS ENTRY (Vercel) — /api/ynda/*
// Gói Express router thành một serverless function duy nhất.
// Vercel map: api/ynda/index.js -> /api/ynda, api/ynda/[...slug].js -> /api/ynda/*
// Cron: nếu slug bắt đầu bằng "cron/", chuyển cho api/cron/ynda-cron.
// =============================================================================

const express = require('express');
const { store } = require('../../lib/ynda');

if (process.env.YNDA_SPREADSHEET_ID || process.env.SPREADSHEET_YNDA) {
  store.initStore();
} else {
  store.initStore({ mode: 'memory' });
}

const router = require('./router');
const cron = require('../cron/ynda-cron');

function buildApp() {
  const app = express();
  app.use(express.json({ limit: '3mb' }));
  app.use((req, res, next) => {
    const slug = (req.path || '').replace(/^\/+/, '');
    if (/^cron\//i.test(slug)) {
      return cron.tick(req, res);
    }
    next();
  });
  app.use(router);
  return app;
}

const app = buildApp();
module.exports = app;