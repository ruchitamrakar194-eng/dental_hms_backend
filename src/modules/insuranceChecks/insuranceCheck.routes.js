'use strict';
const { Router } = require('express');
const controller = require('./insuranceCheck.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { clinicGuard, authorize } = require('../../middlewares/role.middleware');

const router = Router();

router.use(authenticate);
router.use(clinicGuard);

router.get(
  '/',
  authorize('super_admin', 'clinic_owner', 'front_desk', 'billing_staff'),
  controller.list
);

router.post(
  '/',
  authorize('super_admin', 'clinic_owner', 'front_desk'),
  controller.create
);

router.put(
  '/:id',
  authorize('super_admin', 'clinic_owner', 'front_desk', 'billing_staff'),
  controller.update
);

module.exports = router;
