'use strict';
const { Router } = require('express');
const controller = require('./appointment.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { clinicGuard, authorize } = require('../../middlewares/role.middleware');

const router = Router();

// All routes require authentication + clinic scoping
router.use(authenticate);
router.use(clinicGuard);

// GET /api/v1/appointments?date=YYYY-MM-DD
router.get(
  '/',
  authorize(
    'super_admin', 'clinic_owner', 'dentist', 'dental_assistant',
    'hygienist', 'front_desk', 'billing_staff', 'lab_coordinator', 'patient'
  ),
  controller.list
);

// POST /api/v1/appointments
router.post(
  '/',
  authorize('super_admin', 'clinic_owner', 'dentist', 'dental_assistant', 'front_desk'),
  controller.create
);

// PATCH /api/v1/appointments/:id/status (legacy compatibility)
router.patch(
  '/:id/status',
  authorize('super_admin', 'clinic_owner', 'dentist', 'dental_assistant', 'hygienist', 'front_desk'),
  controller.updateStatus
);

// PUT /api/v1/appointments/:id/stage
router.put(
  '/:id/stage',
  authorize('super_admin', 'clinic_owner', 'dentist', 'dental_assistant', 'hygienist', 'front_desk'),
  controller.updateStage
);

// PUT /api/v1/appointments/:id/assign-doctor
router.put(
  '/:id/assign-doctor',
  authorize('super_admin', 'clinic_owner', 'front_desk', 'dentist'),
  controller.assignDoctor
);

// PUT /api/v1/appointments/:id/assign-assistant
router.put(
  '/:id/assign-assistant',
  authorize('super_admin', 'clinic_owner', 'front_desk', 'dentist'),
  controller.assignAssistant
);

// PUT /api/v1/appointments/:id/assign-hygienist
router.put(
  '/:id/assign-hygienist',
  authorize('super_admin', 'clinic_owner', 'front_desk', 'dentist'),
  controller.assignHygienist
);

// GET /api/v1/appointments/:id/chairside
router.get(
  '/:id/chairside',
  authorize('super_admin', 'clinic_owner', 'dentist', 'dental_assistant', 'hygienist'),
  controller.getChairside
);

// PUT /api/v1/appointments/:id/chairside
router.put(
  '/:id/chairside',
  authorize('super_admin', 'clinic_owner', 'dentist', 'dental_assistant'),
  controller.updateChairside
);

// PUT /api/v1/appointments/:id
router.put(
  '/:id',
  authorize('super_admin', 'clinic_owner', 'dentist', 'dental_assistant', 'front_desk'),
  controller.update
);

// DELETE /api/v1/appointments/:id
router.delete(
  '/:id',
  authorize('super_admin', 'clinic_owner', 'front_desk'),
  controller.remove
);

module.exports = router;
