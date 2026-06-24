'use strict';
const aiService = require('./ai.service');
const { success, error } = require('../../utils/response');

/**
 * Helper to standardise error messages
 */
const handleAIError = (res, err) => {
  if (err.message === 'AI service not configured' || err.statusCode === 501) {
    return error(res, 'AI service not configured', 501);
  }
  return error(res, err.message || 'Internal AI Error', err.statusCode || 500);
};

/**
 * POST /ai/diagnosis
 */
const generateDiagnosis = async (req, res, next) => {
  try {
    const { symptoms, history, age, previousTreatments, notes, patientId, patientName } = req.body;
    const clinicId = req.user.clinicId;
    const userId = req.user.id;

    if (!clinicId) {
      return error(res, 'User is not linked to a clinic', 403);
    }

    const data = await aiService.generateDiagnosis({
      symptoms: symptoms || '',
      history: history || '',
      age: age || 30,
      previousTreatments: previousTreatments || '',
      notes: notes || '',
      clinicId,
      userId,
      patientId: patientId || 'default-patient',
      patientName: patientName || 'Patient'
    });

    return success(res, data, 'Diagnosis suggestion generated successfully');
  } catch (err) {
    return handleAIError(res, err);
  }
};

/**
 * POST /ai/treatment-plan
 */
const generateTreatmentPlan = async (req, res, next) => {
  try {
    const { diagnosis, history, notes } = req.body;
    const clinicId = req.user.clinicId;
    const userId = req.user.id;

    if (!clinicId) {
      return error(res, 'User is not linked to a clinic', 403);
    }

    const data = await aiService.generateTreatmentPlan({
      diagnosis: diagnosis || '',
      history: history || '',
      notes: notes || '',
      clinicId,
      userId
    });

    return success(res, data, 'Treatment plan suggestion generated successfully');
  } catch (err) {
    return handleAIError(res, err);
  }
};

/**
 * POST /ai/alerts/analyze
 */
const analyzeAlerts = async (req, res, next) => {
  try {
    const { symptoms, history, patientId, patientName } = req.body;
    const clinicId = req.user.clinicId;
    const userId = req.user.id;

    if (!clinicId) {
      return error(res, 'User is not linked to a clinic', 403);
    }

    const data = await aiService.analyzeAlerts({
      symptoms: symptoms || '',
      history: history || '',
      clinicId,
      userId,
      patientId: patientId || 'default-patient',
      patientName: patientName || 'Patient'
    });

    return success(res, data, 'Smart alerts check completed successfully');
  } catch (err) {
    return handleAIError(res, err);
  }
};

/**
 * POST /ai/summarize
 */
const summarizeNotes = async (req, res, next) => {
  try {
    const { notes } = req.body;
    const clinicId = req.user.clinicId;
    const userId = req.user.id;

    if (!clinicId) {
      return error(res, 'User is not linked to a clinic', 403);
    }

    const data = await aiService.summarizeNotes({
      notes: notes || '',
      clinicId,
      userId
    });

    return success(res, data, 'Clinical notes summary generated successfully');
  } catch (err) {
    return handleAIError(res, err);
  }
};

/**
 * POST /ai/risk-score
 */
const calculateRiskScore = async (req, res, next) => {
  try {
    const { symptoms, history, age } = req.body;
    const clinicId = req.user.clinicId;
    const userId = req.user.id;

    if (!clinicId) {
      return error(res, 'User is not linked to a clinic', 403);
    }

    const data = await aiService.calculateRiskScore({
      symptoms: symptoms || '',
      history: history || '',
      age: age || 30,
      clinicId,
      userId
    });

    return success(res, data, 'Gum disease risk scoring completed successfully');
  } catch (err) {
    return handleAIError(res, err);
  }
};

/**
 * POST /ai/analyze-xray
 */
const analyzeXray = async (req, res, next) => {
  try {
    const { base64Image, imageType, xrayId } = req.body;
    const clinicId = req.user.clinicId;
    const userId = req.user.id;

    if (!clinicId) {
      return error(res, 'User is not linked to a clinic', 403);
    }
    if (!base64Image) {
      return error(res, 'Base64 image data is required', 400);
    }

    const data = await aiService.analyzeXray({
      base64Image,
      imageType: imageType || 'General',
      xrayId,
      clinicId,
      userId
    });

    return success(res, data, 'Radiograph visual analysis completed successfully');
  } catch (err) {
    return handleAIError(res, err);
  }
};

/**
 * POST /ai/patient-summary
 */
const generatePatientSummary = async (req, res, next) => {
  try {
    const { patientId } = req.body;
    const clinicId = req.user.clinicId;
    const userId = req.user.id;

    if (!clinicId) {
      return error(res, 'User is not linked to a clinic', 403);
    }
    if (!patientId) {
      return error(res, 'patientId is required', 400);
    }

    const data = await aiService.generatePatientSummary({
      patientId,
      clinicId,
      userId
    });

    return success(res, data, 'Patient clinical summary generated successfully');
  } catch (err) {
    return handleAIError(res, err);
  }
};

module.exports = {
  generateDiagnosis,
  generateTreatmentPlan,
  analyzeAlerts,
  summarizeNotes,
  calculateRiskScore,
  analyzeXray,
  generatePatientSummary
};
