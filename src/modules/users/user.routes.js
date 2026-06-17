'use strict';
const { Router } = require('express');
const controller = require('./user.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');

const router = Router();

router.use(authenticate);

// ─── Staff-accessible routes (all clinical roles) ─────────────────────────────

// GET /api/v1/users/staff/dentists — returns all dentists in caller's clinic
// Must be BEFORE '/:id' to avoid param clash
router.get(
  '/staff/dentists',
  authorize(
    'super_admin', 'clinic_owner', 'dentist', 'dental_assistant',
    'hygienist', 'front_desk', 'billing_staff', 'lab_coordinator'
  ),
  controller.listDentists
);

// GET /api/v1/users/staff/assistants — returns all assistants in caller's clinic
router.get(
  '/staff/assistants',
  authorize(
    'super_admin', 'clinic_owner', 'dentist', 'dental_assistant',
    'hygienist', 'front_desk', 'billing_staff', 'lab_coordinator'
  ),
  controller.listAssistants
);

// GET /api/v1/users/staff/hygienists — returns all hygienists in caller's clinic
router.get(
  '/staff/hygienists',
  authorize(
    'super_admin', 'clinic_owner', 'dentist', 'dental_assistant',
    'hygienist', 'front_desk', 'billing_staff', 'lab_coordinator'
  ),
  controller.listHygienists
);

// ─── Admin-only routes ────────────────────────────────────────────────────────

router.get(
  '/',
  authorize('super_admin', 'clinic_owner'),
  controller.list
);

router.get(
  '/:id',
  authorize('super_admin', 'clinic_owner'),
  controller.get
);

router.post(
  '/',
  authorize('super_admin', 'clinic_owner'),
  controller.create
);

router.put(
  '/:id',
  authorize('super_admin', 'clinic_owner'),
  controller.update
);

router.delete(
  '/:id',
  authorize('super_admin', 'clinic_owner'),
  controller.remove
);

router.patch(
  '/:id/approve',
  authorize('super_admin'),
  controller.approve
);

module.exports = router;
