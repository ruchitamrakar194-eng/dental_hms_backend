'use strict';
const labCaseService = require('./labCase.service');
const { success } = require('../../utils/response');

const list = async (req, res, next) => {
  try {
    const clinicId = req.clinicId || req.user.clinicId;
    const cases = await labCaseService.listLabCases({ 
      clinicId, 
      userId: req.user.id, 
      role: req.user.role 
    });
    return success(res, cases, 'Lab cases fetched successfully');
  } catch (err) {
    next(err);
  }
};

const get = async (req, res, next) => {
  try {
    const { id } = req.params;
    const clinicId = req.clinicId || req.user.clinicId;
    const labCase = await labCaseService.getLabCaseById({ id, clinicId });
    return success(res, labCase, 'Lab case details fetched successfully');
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const clinicId = req.clinicId || req.user.clinicId;
    const labCase = await labCaseService.createLabCase({ clinicId, body: req.body });
    return success(res, labCase, 'Lab case created successfully', 201);
  } catch (err) {
    next(err);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const clinicId = req.clinicId || req.user.clinicId;
    const { status } = req.body;
    const labCase = await labCaseService.updateLabCaseStatus({ id, clinicId, status });
    return success(res, labCase, 'Lab case status updated successfully');
  } catch (err) {
    next(err);
  }
};

const assignLab = async (req, res, next) => {
  try {
    const { id } = req.params;
    const clinicId = req.clinicId || req.user.clinicId;
    const { labName, expectedDelivery } = req.body;
    const labCase = await labCaseService.assignLabCase({ id, clinicId, labName, expectedDelivery });
    return success(res, labCase, 'Lab assigned successfully');
  } catch (err) {
    next(err);
  }
};

const updateImplant = async (req, res, next) => {
  try {
    const { id } = req.params;
    const clinicId = req.clinicId || req.user.clinicId;
    const labCase = await labCaseService.updateImplantStage({ id, clinicId, ...req.body });
    return success(res, labCase, 'Implant stage updated successfully');
  } catch (err) {
    next(err);
  }
};

const updateCrown = async (req, res, next) => {
  try {
    const { id } = req.params;
    const clinicId = req.clinicId || req.user.clinicId;
    const labCase = await labCaseService.updateCrownTracking({ id, clinicId, ...req.body });
    return success(res, labCase, 'Crown tracking updated successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  list,
  get,
  create,
  updateStatus,
  assignLab,
  updateImplant,
  updateCrown
};
