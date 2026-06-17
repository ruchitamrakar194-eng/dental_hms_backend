'use strict';
const clinicService = require('./clinic.service');
const { success } = require('../../utils/response');

const list = async (req, res, next) => {
  try {
    const clinics = await clinicService.listClinics();
    return success(res, clinics, 'Clinics list fetched successfully');
  } catch (err) {
    next(err);
  }
};

const get = async (req, res, next) => {
  try {
    const { id } = req.params;
    const clinic = await clinicService.getClinicById(id);
    return success(res, clinic, 'Clinic details fetched successfully');
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const clinic = await clinicService.createClinic(req.body);
    return success(res, clinic, 'Clinic created successfully', 201);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (req.user.role === 'clinic_owner' && req.user.clinicId !== id) {
      return res.status(403).json({ success: false, message: 'Access denied: Cannot update a different clinic.' });
    }
    const clinic = await clinicService.updateClinic(id, req.body);
    return success(res, clinic, 'Clinic updated successfully');
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await clinicService.deleteClinic(id);
    return success(res, result, 'Clinic deleted successfully');
  } catch (err) {
    next(err);
  }
};

const toggleAi = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { moduleName } = req.body;
    if (!moduleName) {
      return res.status(400).json({ success: false, message: 'moduleName is required' });
    }
    const clinic = await clinicService.toggleAiModule(id, { moduleName });
    return success(res, clinic, 'AI module status toggled');
  } catch (err) {
    next(err);
  }
};

const changeSubscription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { plan, status, monthlyFee } = req.body;
    if (!plan || !status) {
      return res.status(400).json({ success: false, message: 'plan and status are required' });
    }
    const clinic = await clinicService.updateSubscription(id, { plan, status, monthlyFee });
    return success(res, clinic, 'Clinic subscription updated');
  } catch (err) {
    next(err);
  }
};

const changeStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'status is required' });
    }
    const clinic = await clinicService.updateStatus(id, { status });
    return success(res, clinic, 'Clinic status updated');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  list,
  get,
  create,
  update,
  remove,
  toggleAi,
  changeSubscription,
  changeStatus,
};
