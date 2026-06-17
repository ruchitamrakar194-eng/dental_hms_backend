'use strict';
const { Router } = require('express');
const controller = require('./clinic.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');

const router = Router();

// Scoped to authenticate + super_admin for managing all clinics
router.use(authenticate);

router.get(
  '/',
  authorize('super_admin'),
  controller.list
);

router.get(
  '/:id',
  authorize('super_admin', 'clinic_owner'),
  controller.get
);

router.post(
  '/',
  authorize('super_admin'),
  controller.create
);

router.put(
  '/:id',
  authorize('super_admin', 'clinic_owner'),
  controller.update
);

router.delete(
  '/:id',
  authorize('super_admin'),
  controller.remove
);

router.patch(
  '/:id/ai-modules',
  authorize('super_admin'),
  controller.toggleAi
);

router.patch(
  '/:id/subscription',
  authorize('super_admin'),
  controller.changeSubscription
);

router.patch(
  '/:id/status',
  authorize('super_admin'),
  controller.changeStatus
);

module.exports = router;
