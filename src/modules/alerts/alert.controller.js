'use strict';
const alertService = require('./alert.service');
const { success } = require('../../utils/response');

const list = async (req, res, next) => {
  try {
    const clinicId = req.clinicId || req.user.clinicId;
    const userId = req.user.id;
    const role = req.user.role;

    const alerts = await alertService.listAlerts({ clinicId, userId, role });
    return success(res, alerts, 'Alerts retrieved successfully');
  } catch (err) {
    next(err);
  }
};

const markRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const alert = await alertService.markAsRead(id);
    return success(res, alert, 'Alert marked as read successfully');
  } catch (err) {
    next(err);
  }
};

const markAllRead = async (req, res, next) => {
  try {
    const clinicId = req.clinicId || req.user.clinicId;
    const userId = req.user.id;
    const role = req.user.role;

    await alertService.markAllAsRead({ clinicId, userId, role });
    return success(res, {}, 'All alerts marked as read successfully');
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { title, message, type, role, targetClinicId } = req.body;
    const alert = await alertService.createAlert({
      clinicId: targetClinicId || null,
      userId: null,
      role: role || 'super_admin',
      title,
      message,
      type
    });
    return success(res, alert, 'Alert created successfully', 201);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  list,
  markRead,
  markAllRead,
  create
};
