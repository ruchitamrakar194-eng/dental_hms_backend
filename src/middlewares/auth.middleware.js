'use strict';
const { verifyAccessToken } = require('../utils/jwt');
const { error } = require('../utils/response');
const prisma = require('../config/db');

/**
 * Authenticate middleware — verifies Bearer JWT
 * Attaches req.user = { id, email, role, clinicId }
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(res, 'Access token required', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    // Verify user still exists in DB
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        clinicId: true,
        status: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      return error(res, 'User not found or deleted', 401);
    }

    if (user.status === 'Suspended') {
      return error(res, 'Account suspended. Contact admin.', 403);
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(res, 'Access token expired', 401);
    }
    if (err.name === 'JsonWebTokenError') {
      return error(res, 'Invalid access token', 401);
    }
    return error(res, 'Authentication failed', 401);
  }
};

module.exports = { authenticate };
