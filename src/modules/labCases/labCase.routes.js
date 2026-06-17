'use strict';
const { Router } = require('express');
const controller = require('./labCase.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { clinicGuard, authorize } = require('../../middlewares/role.middleware');

const router = Router();

router.use(authenticate);
router.use(clinicGuard);

router.get(
  '/',
  authorize('super_admin', 'clinic_owner', 'dentist', 'lab_coordinator', 'dental_assistant', 'patient'),
  controller.list
);

router.get(
  '/:id',
  authorize('super_admin', 'clinic_owner', 'dentist', 'lab_coordinator', 'dental_assistant', 'patient'),
  controller.get
);

router.post(
  '/',
  authorize('super_admin', 'clinic_owner', 'dentist', 'lab_coordinator', 'dental_assistant'),
  controller.create
);

router.put(
  '/:id/status',
  authorize('super_admin', 'clinic_owner', 'dentist', 'lab_coordinator', 'dental_assistant'),
  controller.updateStatus
);

router.put(
  '/:id/assign',
  authorize('super_admin', 'clinic_owner', 'dentist', 'lab_coordinator', 'dental_assistant'),
  controller.assignLab
);

router.put(
  '/:id/implant-stage',
  authorize('super_admin', 'clinic_owner', 'dentist', 'lab_coordinator', 'dental_assistant'),
  controller.updateImplant
);

router.put(
  '/:id/crown-tracking',
  authorize('super_admin', 'clinic_owner', 'dentist', 'lab_coordinator', 'dental_assistant'),
  controller.updateCrown
);

module.exports = router;
