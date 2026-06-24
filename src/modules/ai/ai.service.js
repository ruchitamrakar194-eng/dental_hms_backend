'use strict';
const openaiService = require('./openai.service');
const alertService = require('../alerts/alert.service');
const prisma = require('../../config/db');

/**
 * Helper to check configuration
 */
const checkConfigured = () => {
  if (!openaiService.isOpenAIConfigured()) {
    throw Object.assign(new Error('AI service not configured'), { statusCode: 501 });
  }
};

/**
 * Handle high-risk alert triggers
 */
const handleHighRiskAlert = async ({ clinicId, patientId, patientName, condition, severity = 'warning' }) => {
  try {
    await alertService.createAlert({
      clinicId,
      title: `Clinical Safety Engine Warning`,
      message: `System safety alert for patient ${patientName || 'Record'}: "${condition}".`,
      type: severity === 'critical' ? 'critical' : 'warning',
      role: 'dentist'
    });
  } catch (err) {
    console.error('[Safety Alerts] Failed to create alert:', err.message);
  }
};

/**
 * 1. AI Diagnosis
 */
const generateDiagnosis = async (params) => {
  checkConfigured();
  return openaiService.generateDiagnosis(params);
};

/**
 * 2. AI Treatment Suggestion
 */
const generateTreatmentPlan = async (params) => {
  checkConfigured();
  return openaiService.generateTreatmentPlan(params);
};

/**
 * 3. AI Alerts Check
 */
const analyzeAlerts = async (params) => {
  checkConfigured();
  const result = await openaiService.analyzeAlerts(params);
  
  if (result.hasAlert && (result.severity === 'critical' || result.severity === 'warning')) {
    await handleHighRiskAlert({
      clinicId: params.clinicId,
      patientId: params.patientId,
      patientName: params.patientName,
      condition: result.alertMessage,
      severity: result.severity
    });
  }
  return result;
};

/**
 * 4. SOAP / Notes Summarizer
 */
const summarizeNotes = async (params) => {
  checkConfigured();
  return openaiService.summarizeNotes(params);
};

/**
 * 5. Gum Disease Risk Score
 */
const calculateRiskScore = async (params) => {
  checkConfigured();
  return openaiService.calculateRiskScore(params);
};

/**
 * 6. OpenAI Vision Radiograph Analysis
 */
const analyzeXray = async (params) => {
  checkConfigured();
  const result = await openaiService.analyzeXray(params);
  
  // Update X-ray file record if xrayId is provided
  if (params.xrayId) {
    try {
      await prisma.xrayFile.update({
        where: { id: params.xrayId },
        data: {
          isScanned: true,
          aiReport: JSON.stringify(result)
        }
      });
    } catch (err) {
      console.error('[Vision Analysis] Failed to save result to xrayFile:', err.message);
    }
  }
  return result;
};

/**
 * 7. AI Clinical Copilot Summary
 */
const generatePatientSummary = async ({ patientId, clinicId, userId }) => {
  checkConfigured();
  
  // Gather patient information from database
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, clinicId },
    include: {
      appointments: { take: 5, orderBy: { date: 'desc' } },
      prescriptions: true,
      treatmentPlans: true,
      xrayFiles: { take: 5, orderBy: { date: 'desc' } },
      clinicalNotes: { take: 5, orderBy: { createdAt: 'desc' } }
    }
  });

  if (!patient) {
    throw Object.assign(new Error('Patient not found'), { statusCode: 404 });
  }

  // Format historical records for the prompt
  const patientDataForAI = {
    id: patient.id,
    name: patient.name,
    age: patient.age,
    gender: patient.gender,
    allergies: patient.allergies || 'None',
    vitals: patient.vitals || 'None',
    history: patient.history || 'None',
    medicalConditions: patient.medicalConditions ? JSON.parse(JSON.stringify(patient.medicalConditions)) : [],
    activeMedications: patient.activeMedications ? JSON.parse(JSON.stringify(patient.activeMedications)) : [],
    appointments: patient.appointments.map(a => ({ type: a.type, date: a.date, status: a.status })),
    prescriptions: patient.prescriptions.map(p => ({ drug: p.drug, dosage: p.dosage, duration: p.duration })),
    treatmentPlans: patient.treatmentPlans.map(tp => ({ tooth: tp.tooth, procedure: tp.procedure, status: tp.status })),
    xrays: patient.xrayFiles.map(x => ({ name: x.name, date: x.date, isScanned: x.isScanned }))
  };

  return openaiService.generatePatientSummary({
    patientData: patientDataForAI,
    clinicId,
    userId
  });
};

module.exports = {
  isOpenAIConfigured: openaiService.isOpenAIConfigured,
  generateDiagnosis,
  generateTreatmentPlan,
  analyzeAlerts,
  summarizeNotes,
  calculateRiskScore,
  analyzeXray,
  generatePatientSummary
};
