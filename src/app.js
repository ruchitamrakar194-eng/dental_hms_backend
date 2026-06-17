'use strict';
require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const config = require('./config/env');
const routes = require('./routes');
const { errorHandler, notFound } = require('./middlewares/error.middleware');
const { UPLOAD_ROOT } = require('./middlewares/upload.middleware');

const app = express();

// ─── SECURITY ─────────────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || config.cors.allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── STATIC UPLOADS ───────────────────────────────────────────────────────────
app.use('/uploads', express.static(UPLOAD_ROOT));

// ─── RATE LIMITING ────────────────────────────────────────────────────────────
app.use('/api/', rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.nodeEnv === 'development' ? 99999 : config.rateLimit.max,
  message: { success: false, message: 'Too many requests, please try again later.' },
}));

// ─── PARSERS ──────────────────────────────────────────────────────────────────
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── LOGGING ──────────────────────────────────────────────────────────────────
if (config.nodeEnv !== 'test') {
  app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));
}

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Dental HMS SaaS Backend — Healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: config.nodeEnv,
  });
});

// ─── API ROUTES ───────────────────────────────────────────────────────────────
app.use('/api/v1', routes);

// ─── 404 + ERROR HANDLER ──────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
