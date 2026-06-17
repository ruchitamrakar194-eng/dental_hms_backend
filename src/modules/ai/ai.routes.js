'use strict';
const { Router } = require('express');
const controller = require('./ai.controller');

const router = Router();

router.post('/diagnosis', controller.generateDiagnosis);
router.post('/treatment-plan', controller.generateTreatmentPlan);
router.post('/alerts/analyze', controller.analyzeAlerts);
router.post('/summarize', controller.summarizeNotes);
router.post('/risk-score', controller.calculateRiskScore);

module.exports = router;
