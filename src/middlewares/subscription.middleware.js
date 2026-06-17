'use strict';
const prisma = require('../config/db');
const { error } = require('../utils/response');

/**
 * Middleware to enforce active clinic subscription on SaaS endpoints.
 * Exempts Super Admins.
 */
const requireActiveSubscription = async (req, res, next) => {
  try {
    // 1. Super Admins bypass subscription checks
    if (req.user.role === 'super_admin') {
      return next();
    }

    const clinicId = req.user.clinicId;
    if (!clinicId) {
      return error(res, 'User is not assigned to any clinic', 403);
    }

    // 2. Fetch clinic's active subscription
    const subscription = await prisma.subscription.findUnique({
      where: { clinicId },
      include: { plan: true }
    });

    // 3. Block access if subscription is missing or not active
    if (!subscription || subscription.status !== 'active') {
      return res.status(402).json({
        success: false,
        message: 'Active subscription required. Please subscribe or renew your plan.',
        code: 'SUBSCRIPTION_REQUIRED'
      });
    }

    // 4. Attach subscription and plan to request context
    req.subscription = subscription;
    req.plan = subscription.plan;
    
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { requireActiveSubscription };
