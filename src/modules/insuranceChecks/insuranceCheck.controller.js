'use strict';
const prisma = require('../../config/db');
const { success, error } = require('../../utils/response');

const list = async (req, res, next) => {
  try {
    const clinicId = req.clinicId || req.user.clinicId;
    const items = await prisma.insuranceCheck.findMany({
      where: { clinicId },
      orderBy: { lastChecked: 'desc' }
    });
    return success(res, items, 'Insurance checks fetched successfully');
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const clinicId = req.clinicId || req.user.clinicId;
    const { patientName, provider, policyNumber } = req.body;
    if (!patientName || !provider || !policyNumber) {
      return error(res, 'Patient name, provider, and policy number are required', 400);
    }
    const item = await prisma.insuranceCheck.create({
      data: {
        clinicId,
        patientName,
        provider,
        policyNumber,
        status: 'Pending',
        coverageDetails: ''
      }
    });
    return success(res, item, 'Insurance check created successfully', 201);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const clinicId = req.clinicId || req.user.clinicId;
    const { status, coverageDetails } = req.body;

    await prisma.insuranceCheck.updateMany({
      where: { id, clinicId },
      data: {
        ...(status && { status }),
        ...(coverageDetails !== undefined && { coverageDetails }),
        lastChecked: new Date()
      }
    });

    const updated = await prisma.insuranceCheck.findFirst({ where: { id, clinicId } });
    return success(res, updated, 'Insurance check updated successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  list,
  create,
  update
};
