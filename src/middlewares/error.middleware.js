'use strict';
const { error } = require('../utils/response');

/**
 * Global error handler middleware
 * Must be registered LAST in Express middleware chain
 */
const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err.message);

  // Prisma known errors
  if (err.code === 'P2002') {
    return error(res, 'A record with this value already exists (duplicate)', 409);
  }
  if (err.code === 'P2025') {
    return error(res, 'Record not found', 404);
  }
  if (err.code === 'P2003') {
    return error(res, 'Related record not found (foreign key constraint)', 400);
  }

  // JWT errors
  if (err.name === 'TokenExpiredError') return error(res, 'Token expired', 401);
  if (err.name === 'JsonWebTokenError') return error(res, 'Invalid token', 401);

  // Validation errors
  if (err.name === 'ValidationError') return error(res, err.message, 422);
  if (err.name === 'MulterError') return error(res, err.message, 400);
  if (err.code === 'LIMIT_FILE_SIZE') return error(res, 'File too large. Maximum size is 15MB.', 400);

  // Default 500
  const statusCode = err.statusCode || err.status || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message || 'Internal server error';

  return error(res, message, statusCode);
};

/**
 * 404 handler — must be registered before errorHandler
 */
const notFound = (req, res) => {
  return error(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
};

module.exports = { errorHandler, notFound };
