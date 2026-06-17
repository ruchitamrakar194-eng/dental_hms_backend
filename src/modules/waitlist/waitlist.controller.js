'use strict';
const prisma = require('../../config/db');
const { success, error } = require('../../utils/response');

const list = async (req, res, next) => {
  try {
    const clinicId = req.clinicId || req.user.clinicId;
    const items = await prisma.waitlistItem.findMany({
      where: { clinicId },
      orderBy: { addedTime: 'asc' }
    });
    return success(res, items, 'Waitlist items fetched successfully');
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const clinicId = req.clinicId || req.user.clinicId;
    const { patientName, phone, preferredTime, priority, reason } = req.body;
    if (!patientName || !phone) {
      return error(res, 'Patient name and phone are required', 400);
    }
    const item = await prisma.waitlistItem.create({
      data: {
        clinicId,
        patientName,
        phone,
        preferredTime: preferredTime || '',
        priority: priority || 'Medium',
        reason: reason || ''
      }
    });
    return success(res, item, 'Added to waitlist successfully', 201);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const clinicId = req.clinicId || req.user.clinicId;
    const { patientName, phone, preferredTime, priority, reason } = req.body;

    await prisma.waitlistItem.updateMany({
      where: { id, clinicId },
      data: {
        ...(patientName && { patientName }),
        ...(phone && { phone }),
        ...(preferredTime !== undefined && { preferredTime }),
        ...(priority && { priority }),
        ...(reason !== undefined && { reason })
      }
    });

    const updated = await prisma.waitlistItem.findFirst({ where: { id, clinicId } });
    return success(res, updated, 'Waitlist item updated successfully');
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const clinicId = req.clinicId || req.user.clinicId;

    await prisma.waitlistItem.deleteMany({
      where: { id, clinicId }
    });

    return success(res, { id }, 'Waitlist item removed successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  list,
  create,
  update,
  remove
};
