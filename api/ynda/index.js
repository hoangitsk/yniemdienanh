'use strict';

// =============================================================================
// YNDA SERVERLESS ENTRY (Vercel) — /api/ynda/*
// Gói Express router thành một serverless function duy nhất.
// Vercel map: api/ynda/index.js -> /api/ynda, api/ynda/[...slug].js -> /api/ynda/*
// Cron: nếu slug bắt đầu bằng "cron/", chuyển cho api/cron/ynda-cron.
// =============================================================================

const express = require('express');
const { store } = require('../../lib/ynda');

// initStore prioritizes SPREADSHEET_RANKING. Without credentials it safely
// selects the in-memory adapter for local development and tests.
store.initStore();

const router = require('./router');
const cron = require('../cron/ynda-cron');

function buildApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '3mb' }));

  // CORS for web client access
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
  });

  // Handle cron requests
  app.use((req, res, next) => {
    const slug = (req.path || '').replace(/^\/api\/ynda\/?/i, '').replace(/^\/+/, '');
    if (/^cron\//i.test(slug)) {
      return cron.tick(req, res);
    }
    next();
  });

  // Mount router on BOTH /api/ynda and / for Vercel Serverless routing compatibility
  app.use('/api/ynda', router);
  app.use('/', router);
  return app;
}

const app = buildApp();
module.exports = app;
