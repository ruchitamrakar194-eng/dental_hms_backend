'use strict';
const { Router } = require('express');
const controller = require('./ai.controller');
const { authenticate } = require('../../middlewares/auth.middleware');

const router = Router();

// Secure all AI endpoints with auth middleware
router.use(authenticate);

router.post('/diagnosis', controller.generateDiagnosis);
router.post('/treatment-plan', controller.generateTreatmentPlan);
router.post('/alerts/analyze', controller.analyzeAlerts);
router.post('/summarize', controller.summarizeNotes);
router.post('/risk-score', controller.calculateRiskScore);
router.post('/analyze-xray', controller.analyzeXray);
router.post('/patient-summary', controller.generatePatientSummary);

module.exports = router;
