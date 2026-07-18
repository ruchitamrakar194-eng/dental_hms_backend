'use strict';
const { Router } = require('express');
const controller = require('./patient.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { clinicGuard, authorize } = require('../../middlewares/role.middleware');
const { xrayUpload } = require('../../middlewares/upload.middleware');

const router = Router();

// Require auth and clinic scoping for all endpoints
router.use(authenticate);
router.use(clinicGuard);

router.get(
  '/',
  authorize(
    'super_admin', 'clinic_owner', 'dentist', 'dental_assistant',
    'hygienist', 'front_desk', 'billing_staff', 'lab_coordinator'
  ),
  controller.list
);

router.get(
  '/procedure-templates',
  authorize('super_admin', 'clinic_owner', 'dentist', 'dental_assistant', 'hygienist'),
  controller.listProcedureTemplates
);

router.post(
  '/procedure-templates',
  authorize('super_admin', 'clinic_owner', 'dentist'),
  controller.createProcedureTemplate
);

router.get(
  '/custom-procedures',
  authorize('super_admin', 'clinic_owner', 'dentist', 'dental_assistant', 'hygienist', 'lab_coordinator'),
  controller.listCustomProcedures
);

router.post(
  '/custom-procedures',
  authorize('super_admin', 'clinic_owner', 'dentist', 'dental_assistant', 'hygienist', 'lab_coordinator'),
  controller.createCustomProcedure
);

router.get(
  '/custom-drugs',
  authorize('super_admin', 'clinic_owner', 'dentist', 'dental_assistant', 'hygienist', 'lab_coordinator'),
  controller.listCustomDrugs
);

router.post(
  '/custom-drugs',
  authorize('super_admin', 'clinic_owner', 'dentist', 'dental_assistant', 'hygienist', 'lab_coordinator'),
  controller.createCustomDrug
);

router.delete(
  '/procedure-templates/:templateId',
  authorize('super_admin', 'clinic_owner', 'dentist'),
  controller.deleteProcedureTemplate
);


router.get(
  '/:id',
  authorize(
    'super_admin', 'clinic_owner', 'dentist', 'dental_assistant',
    'hygienist', 'front_desk', 'billing_staff', 'lab_coordinator', 'patient'
  ),
  controller.get
);

router.post(
  '/',
  authorize('super_admin', 'clinic_owner', 'dentist', 'dental_assistant', 'front_desk'),
  controller.create
);

router.put(
  '/:id',
  authorize('super_admin', 'clinic_owner', 'dentist', 'dental_assistant', 'hygienist', 'front_desk'),
  controller.update
);

router.delete(
  '/:id',
  authorize('super_admin', 'clinic_owner', 'front_desk'),
  controller.remove
);

router.put(
  '/:id/odontogram',
  authorize('super_admin', 'clinic_owner', 'dentist', 'dental_assistant'),
  controller.updateOdontogram
);

router.post(
  '/:id/treatment-plans',
  authorize('super_admin', 'clinic_owner', 'dentist', 'dental_assistant'),
  controller.createTreatmentPlan
);

router.put(
  '/:id/treatment-plans/:planId',
  authorize('super_admin', 'clinic_owner', 'dentist', 'dental_assistant'),
  controller.updateTreatmentPlan
);

router.delete(
  '/:id/treatment-plans/:planId',
  authorize('super_admin', 'clinic_owner', 'dentist', 'dental_assistant'),
  controller.deleteTreatmentPlan
);

router.post(
  '/:id/prescriptions',
  authorize('super_admin', 'clinic_owner', 'dentist'),
  controller.createPrescription
);

router.delete(
  '/:id/prescriptions/:rxId',
  authorize('super_admin', 'clinic_owner', 'dentist'),
  controller.deletePrescription
);

router.post(
  '/:id/notes',
  authorize('super_admin', 'clinic_owner', 'dentist', 'dental_assistant', 'hygienist', 'lab_coordinator'),
  controller.createClinicalNote
);

router.post(
  '/:id/xrays',
  authorize('super_admin', 'clinic_owner', 'dentist', 'dental_assistant', 'hygienist'),
  xrayUpload.single('file'),
  controller.createXray
);

router.put(
  '/:id/xrays/:xrayId',
  authorize('super_admin', 'clinic_owner', 'dentist', 'dental_assistant', 'hygienist'),
  controller.updateXray
);

router.put(
  '/:id/perio-chart',
  authorize('super_admin', 'clinic_owner', 'dentist', 'hygienist'),
  controller.updatePerioChart
);

router.put(
  '/:id/risk-profile',
  authorize('super_admin', 'clinic_owner', 'dentist', 'hygienist'),
  controller.updateRiskProfile
);

router.get(
  '/:id/consent-forms',
  authorize('super_admin', 'clinic_owner', 'dentist', 'dental_assistant', 'hygienist', 'patient'),
  controller.listConsentForms
);

router.post(
  '/:id/consent-forms',
  authorize('super_admin', 'clinic_owner', 'dentist', 'dental_assistant'),
  controller.createConsentForm
);

router.put(
  '/:id/consent-forms/:consentId',
  authorize('super_admin', 'clinic_owner', 'dentist', 'dental_assistant', 'patient'),
  controller.updateConsentForm
);

module.exports = router;
