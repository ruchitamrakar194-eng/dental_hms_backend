'use strict';
const { Router } = require('express');
const controller = require('./waitlist.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { clinicGuard, authorize } = require('../../middlewares/role.middleware');

const router = Router();

router.use(authenticate);
router.use(clinicGuard);

router.get(
  '/',
  authorize('super_admin', 'clinic_owner', 'front_desk', 'dentist'),
  controller.list
);

router.post(
  '/',
  authorize('super_admin', 'clinic_owner', 'front_desk'),
  controller.create
);

router.patch(
  '/:id',
  authorize('super_admin', 'clinic_owner', 'front_desk'),
  controller.update
);

router.delete(
  '/:id',
  authorize('super_admin', 'clinic_owner', 'front_desk'),
  controller.remove
);

module.exports = router;
