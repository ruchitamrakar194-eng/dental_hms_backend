'use strict';
const { error } = require('../utils/response');
const { ROLES } = require('../constants/roles');

/**
 * Role authorization middleware factory
 * Usage: authorize('super_admin', 'clinic_owner')
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return error(res, 'Unauthorized — not authenticated', 401);
    }

    const { role } = req.user;

    if (!allowedRoles.includes(role)) {
      return error(
        res,
        `Access denied. Required roles: [${allowedRoles.join(', ')}]. Your role: ${role}`,
        403
      );
    }

    next();
  };
};

/**
 * Clinic isolation guard
 * Ensures non-super_admin users can only access their own clinicId data
 * Usage: after authenticate() middleware
 */
const clinicGuard = (req, res, next) => {
  if (!req.user) return error(res, 'Unauthorized', 401);

  // Super admin can access all clinics
  if (req.user.role === ROLES.SUPER_ADMIN) return next();

  // For all other roles, inject clinicId from token into query params
  const requestedClinicId = req.params.clinicId || req.query.clinicId || req.body.clinicId;

  if (requestedClinicId && requestedClinicId !== req.user.clinicId) {
    return error(res, 'Access denied — cross-clinic data access prohibited', 403);
  }

  // Auto-inject clinicId from token so controllers don't need to think about it
  req.clinicId = req.user.clinicId;
  next();
};

module.exports = { authorize, clinicGuard };
