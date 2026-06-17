'use strict';
const appointmentService = require('./appointment.service');
const { success } = require('../../utils/response');

const list = async (req, res, next) => {
  try {
    const clinicId = req.clinicId || req.user.clinicId;
    const { date } = req.query;

    const appointments = await appointmentService.listAppointments({
      clinicId,
      role: req.user.role,
      userId: req.user.id,
      date,
    });

    return success(res, appointments, 'Appointments fetched');
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const clinicId = req.clinicId || req.user.clinicId;
    const appointment = await appointmentService.createAppointment({
      clinicId,
      body: req.body,
    });

    return success(res, appointment, 'Appointment created', 201);
  } catch (err) {
    next(err);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const clinicId = req.clinicId || req.user.clinicId;

    if (!status) {
      return res.status(400).json({ success: false, message: 'status is required' });
    }

    const statusToStage = {
      Scheduled: 'SCHEDULED',
      Checked_In: 'CHECKED_IN',
      In_Progress: 'IN_PROGRESS',
      Ready_For_Doctor: 'TREATMENT_PENDING',
      Completed: 'COMPLETED',
      Cancelled: 'CANCELLED',
      No_Show: 'CANCELLED',
      Pending: 'CONFIRMED',
      Arrived: 'CHECKED_IN',
      Done: 'COMPLETED'
    };

    const stage = statusToStage[status] || status.toUpperCase();

    const appointment = await appointmentService.updateWorkflowStage(id, stage, clinicId);
    return success(res, appointment, 'Appointment status updated');
  } catch (err) {
    next(err);
  }
};

const updateStage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stage } = req.body;
    const clinicId = req.clinicId || req.user.clinicId;

    if (!stage) {
      return res.status(400).json({ success: false, message: 'stage is required' });
    }

    const appointment = await appointmentService.updateWorkflowStage(id, stage, clinicId);
    return success(res, appointment, 'Appointment workflow stage updated');
  } catch (err) {
    next(err);
  }
};

const assignDoctor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { doctorId } = req.body;
    const clinicId = req.clinicId || req.user.clinicId;

    if (!doctorId) {
      return res.status(400).json({ success: false, message: 'doctorId is required' });
    }

    const appointment = await appointmentService.assignDoctor(id, doctorId, clinicId);
    return success(res, appointment, 'Doctor assigned successfully');
  } catch (err) {
    next(err);
  }
};

const assignAssistant = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { assistantId } = req.body;
    const clinicId = req.clinicId || req.user.clinicId;

    if (!assistantId) {
      return res.status(400).json({ success: false, message: 'assistantId is required' });
    }

    const appointment = await appointmentService.assignAssistant(id, assistantId, clinicId);
    return success(res, appointment, 'Assistant assigned successfully');
  } catch (err) {
    next(err);
  }
};

const assignHygienist = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { hygienistId } = req.body;
    const clinicId = req.clinicId || req.user.clinicId;

    if (!hygienistId) {
      return res.status(400).json({ success: false, message: 'hygienistId is required' });
    }

    const appointment = await appointmentService.assignHygienist(id, hygienistId, clinicId);
    return success(res, appointment, 'Hygienist assigned successfully');
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const clinicId = req.clinicId || req.user.clinicId;

    const appointment = await appointmentService.updateAppointment({
      id,
      clinicId,
      body: req.body,
    });

    return success(res, appointment, 'Appointment updated');
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const clinicId = req.clinicId || req.user.clinicId;

    const result = await appointmentService.deleteAppointment({ id, clinicId });
    return success(res, result, 'Appointment deleted');
  } catch (err) {
    next(err);
  }
};

const getChairside = async (req, res, next) => {
  try {
    const { id } = req.params;
    const clinicId = req.clinicId || req.user.clinicId;
    const session = await appointmentService.getChairsideSession(id, clinicId);
    return success(res, session, 'Chairside session fetched');
  } catch (err) {
    next(err);
  }
};

const updateChairside = async (req, res, next) => {
  try {
    const { id } = req.params;
    const clinicId = req.clinicId || req.user.clinicId;
    const session = await appointmentService.upsertChairsideSession(id, clinicId, req.body);
    return success(res, session, 'Chairside session saved');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  list,
  create,
  updateStatus,
  updateStage,
  assignDoctor,
  assignAssistant,
  assignHygienist,
  update,
  remove,
  getChairside,
  updateChairside,
};
