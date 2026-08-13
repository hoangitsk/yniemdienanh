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
