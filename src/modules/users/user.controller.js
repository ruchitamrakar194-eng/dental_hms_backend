'use strict';
const userService = require('./user.service');
const { success } = require('../../utils/response');

const list = async (req, res, next) => {
  try {
    // Super admins can get all users or filter by clinicId. Other roles only see users in their clinic.
    const clinicId = req.user.role === 'super_admin' ? req.query.clinicId : req.user.clinicId;
    const users = await userService.listUsers({ clinicId });
    return success(res, users, 'Users list fetched successfully');
  } catch (err) {
    next(err);
  }
};

const get = async (req, res, next) => {
  try {
    const { id } = req.params;
    // Clinic owner/staff can get users, but enforce clinicId check
    const user = await userService.getUserById(id);
    if (req.user.role !== 'super_admin' && user.clinicId !== req.user.clinicId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    return success(res, user, 'User details fetched successfully');
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    // If not super admin, force their clinicId
    const clinicId = req.user.role === 'super_admin' ? req.body.clinicId : req.user.clinicId;
    const user = await userService.createUser({ ...req.body, clinicId });
    return success(res, user, 'User created successfully', 201);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    // Scoping check
    const user = await userService.getUserById(id);
    if (req.user.role !== 'super_admin' && user.clinicId !== req.user.clinicId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const clinicId = req.user.role === 'super_admin' ? req.body.clinicId : req.user.clinicId;
    const updated = await userService.updateUser(id, { ...req.body, clinicId });
    return success(res, updated, 'User updated successfully');
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await userService.getUserById(id);
    if (req.user.role !== 'super_admin' && user.clinicId !== req.user.clinicId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const result = await userService.deleteUser(id);
    return success(res, result, 'User deleted successfully');
  } catch (err) {
    next(err);
  }
};

const approve = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await userService.approveUser(id);
    return success(res, user, 'User account approved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /users/staff/dentists
 * Returns all approved dentists in the caller's clinic.
 * Accessible by all clinical roles for appointment booking.
 */
const listDentists = async (req, res, next) => {
  try {
    const clinicId = req.user.clinicId;
    const dentists = await userService.listUsers({ clinicId, role: 'dentist' });
    return success(res, dentists, 'Dentists fetched successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /users/staff/assistants
 * Returns all approved assistants in the caller's clinic.
 */
const listAssistants = async (req, res, next) => {
  try {
    const clinicId = req.user.clinicId;
    const assistants = await userService.listUsers({ clinicId, role: 'dental_assistant' });
    return success(res, assistants, 'Assistants fetched successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /users/staff/hygienists
 * Returns all approved hygienists in the caller's clinic.
 */
const listHygienists = async (req, res, next) => {
  try {
    const clinicId = req.user.clinicId;
    const hygienists = await userService.listUsers({ clinicId, role: 'hygienist' });
    return success(res, hygienists, 'Hygienists fetched successfully');
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
  approve,
  listDentists,
  listAssistants,
  listHygienists,
};

