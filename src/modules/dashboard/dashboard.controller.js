'use strict';
const dashboardService = require('./dashboard.service');
const { success, error } = require('../../utils/response');

const getStats = async (req, res, next) => {
  try {
    const { clinicId: queryClinicId } = req.query;
    const userRole = req.user.role;
    let clinicId = req.user.clinicId;

    // Allow super admin or global filters to pass specific clinicId
    if ((userRole === 'super_admin' || userRole === 'clinic_owner') && queryClinicId) {
      clinicId = queryClinicId;
    }

    if (!clinicId && userRole !== 'super_admin') {
      return error(res, 'User is not linked to any clinic', 403);
    }

    const data = await dashboardService.getStats(clinicId || 'all');
    return success(res, data, 'Dashboard stats retrieved successfully');
  } catch (err) {
    next(err);
  }
};

const getInsights = async (req, res, next) => {
  try {
    const { clinicId: queryClinicId } = req.query;
    const userRole = req.user.role;
    let clinicId = req.user.clinicId;

    if ((userRole === 'super_admin' || userRole === 'clinic_owner') && queryClinicId) {
      clinicId = queryClinicId;
    }

    if (!clinicId && userRole !== 'super_admin') {
      return error(res, 'User is not linked to any clinic', 403);
    }

    const data = await dashboardService.getInsights(clinicId || 'all');
    return success(res, data, 'AI dashboard insights retrieved successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getStats,
  getInsights
};
