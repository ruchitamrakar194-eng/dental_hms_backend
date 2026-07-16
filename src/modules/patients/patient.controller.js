'use strict';
const patientService = require('./patient.service');
const { success } = require('../../utils/response');

const list = async (req, res, next) => {
  try {
    const clinicId = req.clinicId || req.user.clinicId;
    const patients = await patientService.listPatients({ 
      clinicId, 
      userId: req.user.id, 
      role: req.user.role 
    });
    return success(res, patients, 'Patients list fetched successfully');
  } catch (err) {
    next(err);
  }
};

const get = async (req, res, next) => {
  try {
    const { id } = req.params;
    const clinicId = req.clinicId || req.user.clinicId;
    const patient = await patientService.getPatientById({ id, clinicId });
    return success(res, patient, 'Patient details fetched successfully');
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const clinicId = req.clinicId || req.user.clinicId;
    const patient = await patientService.createPatient({ clinicId, body: req.body });
    return success(res, patient, 'Patient registered successfully', 201);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const clinicId = req.clinicId || req.user.clinicId;
    const patient = await patientService.updatePatient({ id, clinicId, body: req.body });
    return success(res, patient, 'Patient updated successfully');
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const clinicId = req.clinicId || req.user.clinicId;
    const result = await patientService.deletePatient({ id, clinicId });
    return success(res, result, 'Patient deleted successfully');
  } catch (err) {
    next(err);
  }
};

const updateOdontogram = async (req, res, next) => {
  try {
    const { id: patientId } = req.params;
    const clinicId = req.clinicId || req.user.clinicId;
    const { chartData } = req.body;
    const result = await patientService.updateOdontogram({ patientId, clinicId, chartData });
    return success(res, result, 'Odontogram updated successfully');
  } catch (err) {
    next(err);
  }
};

const createTreatmentPlan = async (req, res, next) => {
  try {
    const { id: patientId } = req.params;
    const clinicId = req.clinicId || req.user.clinicId;
    const { tooth, procedure, cost, status } = req.body;
    const result = await patientService.createTreatmentPlan({ patientId, clinicId, tooth, procedure, cost, status });
    return success(res, result, 'Treatment plan created successfully', 201);
  } catch (err) {
    next(err);
  }
};

const updateTreatmentPlan = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const clinicId = req.clinicId || req.user.clinicId;
    const { status } = req.body;
    const result = await patientService.updateTreatmentPlan({ planId, clinicId, status });
    return success(res, result, 'Treatment plan updated successfully');
  } catch (err) {
    next(err);
  }
};

const deleteTreatmentPlan = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const clinicId = req.clinicId || req.user.clinicId;
    const result = await patientService.deleteTreatmentPlan({ planId, clinicId });
    return success(res, result, 'Treatment plan deleted successfully');
  } catch (err) {
    next(err);
  }
};

const createPrescription = async (req, res, next) => {
  try {
    const { id: patientId } = req.params;
    const clinicId = req.clinicId || req.user.clinicId;
    const { drug, dosage, frequency, duration } = req.body;
    const result = await patientService.createPrescription({ patientId, clinicId, drug, dosage, frequency, duration });
    return success(res, result, 'Prescription created successfully', 201);
  } catch (err) {
    next(err);
  }
};

const deletePrescription = async (req, res, next) => {
  try {
    const { rxId } = req.params;
    const clinicId = req.clinicId || req.user.clinicId;
    const result = await patientService.deletePrescription({ rxId, clinicId });
    return success(res, result, 'Prescription deleted successfully');
  } catch (err) {
    next(err);
  }
};

const createClinicalNote = async (req, res, next) => {
  try {
    const { id: patientId } = req.params;
    const clinicId = req.clinicId || req.user.clinicId;
    const { content } = req.body;
    const authorId = req.user.id;
    const result = await patientService.createClinicalNote({ patientId, clinicId, content, authorId });
    return success(res, result, 'Clinical note created successfully', 201);
  } catch (err) {
    next(err);
  }
};

const createXray = async (req, res, next) => {
  try {
    const { id: patientId } = req.params;
    const clinicId = req.clinicId || req.user.clinicId;
    const { notes, isScanned, aiReport, type } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'X-ray file is required' });
    }

    const fileUrl = `/uploads/xrays/${file.filename}`;
    const result = await patientService.createXray({
      patientId,
      clinicId,
      name: file.originalname,
      notes,
      isScanned,
      aiReport,
      fileUrl,
      type: type || 'General',
    });
    return success(res, result, 'X-ray record added successfully', 201);
  } catch (err) {
    next(err);
  }
};

const updateXray = async (req, res, next) => {
  try {
    const { xrayId } = req.params;
    const clinicId = req.clinicId || req.user.clinicId;
    const { isScanned, aiReport, annotationsData } = req.body;
    const result = await patientService.updateXray({ xrayId, clinicId, isScanned, aiReport, annotationsData });
    return success(res, result, 'X-ray updated successfully');
  } catch (err) {
    next(err);
  }
};

const updatePerioChart = async (req, res, next) => {
  try {
    const { id: patientId } = req.params;
    const clinicId = req.clinicId || req.user.clinicId;
    const { perioChartData } = req.body;
    const result = await patientService.updatePerioChart({ patientId, clinicId, perioChartData });
    return success(res, result, 'Perio chart updated successfully');
  } catch (err) {
    next(err);
  }
};

const updateRiskProfile = async (req, res, next) => {
  try {
    const { id: patientId } = req.params;
    const clinicId = req.clinicId || req.user.clinicId;
    const { riskProfileData } = req.body;
    const result = await patientService.updateRiskProfile({ patientId, clinicId, riskProfileData });
    return success(res, result, 'Risk profile updated successfully');
  } catch (err) {
    next(err);
  }
};

const listConsentForms = async (req, res, next) => {
  try {
    const { id: patientId } = req.params;
    const clinicId = req.clinicId || req.user.clinicId;
    const result = await patientService.listConsentForms({ patientId, clinicId });
    return success(res, result, 'Consent forms fetched successfully');
  } catch (err) {
    next(err);
  }
};

const createConsentForm = async (req, res, next) => {
  try {
    const { id: patientId } = req.params;
    const clinicId = req.clinicId || req.user.clinicId;
    const { patientName, type, content } = req.body;
    const result = await patientService.createConsentForm({ patientId, clinicId, patientName, type, content });
    return success(res, result, 'Consent form created successfully', 201);
  } catch (err) {
    next(err);
  }
};

const updateConsentForm = async (req, res, next) => {
  try {
    const { consentId } = req.params;
    const clinicId = req.clinicId || req.user.clinicId;
    const { signature, status, signedAt } = req.body;
    const result = await patientService.updateConsentForm({ consentId, clinicId, signature, status, signedAt });
    return success(res, result, 'Consent form updated successfully');
  } catch (err) {
    next(err);
  }
};

const listProcedureTemplates = async (req, res, next) => {
  try {
    const clinicId = req.clinicId || req.user.clinicId;
    const result = await patientService.listProcedureTemplates({ clinicId });
    return success(res, result, 'Procedure templates fetched successfully');
  } catch (err) {
    next(err);
  }
};

const createProcedureTemplate = async (req, res, next) => {
  try {
    const clinicId = req.clinicId || req.user.clinicId;
    const { title, content } = req.body;
    const result = await patientService.createProcedureTemplate({ clinicId, title, content });
    return success(res, result, 'Procedure template created successfully', 201);
  } catch (err) {
    next(err);
  }
};

const deleteProcedureTemplate = async (req, res, next) => {
  try {
    const { templateId } = req.params;
    const clinicId = req.clinicId || req.user.clinicId;
    const result = await patientService.deleteProcedureTemplate({ templateId, clinicId });
    return success(res, result, 'Procedure template deleted successfully');
  } catch (err) {
    next(err);
  }
};

const listCustomProcedures = async (req, res, next) => {
  try {
    const clinicId = req.clinicId || req.user.clinicId;
    const result = await patientService.listCustomProcedures({ clinicId });
    return success(res, result, 'Custom procedures fetched successfully');
  } catch (err) {
    next(err);
  }
};

const createCustomProcedure = async (req, res, next) => {
  try {
    const clinicId = req.clinicId || req.user.clinicId;
    const { value, label, defaultCost } = req.body;
    const result = await patientService.createCustomProcedure({
      clinicId,
      value,
      label,
      defaultCost: Number(defaultCost)
    });
    return success(res, result, 'Custom procedure created successfully', 201);
  } catch (err) {
    next(err);
  }
};

const listCustomDrugs = async (req, res, next) => {
  try {
    const clinicId = req.clinicId || req.user.clinicId;
    const result = await patientService.listCustomDrugs({ clinicId });
    return success(res, result, 'Custom drugs fetched successfully');
  } catch (err) {
    next(err);
  }
};

const createCustomDrug = async (req, res, next) => {
  try {
    const clinicId = req.clinicId || req.user.clinicId;
    const { value, label } = req.body;
    const result = await patientService.createCustomDrug({
      clinicId,
      value,
      label
    });
    return success(res, result, 'Custom drug created successfully', 201);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  list,
  get,
  create,
  update,
  remove,
  updateOdontogram,
  createTreatmentPlan,
  updateTreatmentPlan,
  deleteTreatmentPlan,
  createPrescription,
  deletePrescription,
  createClinicalNote,
  createXray,
  updateXray,
  updatePerioChart,
  updateRiskProfile,
  listConsentForms,
  createConsentForm,
  updateConsentForm,
  listProcedureTemplates,
  createProcedureTemplate,
  deleteProcedureTemplate,
  listCustomProcedures,
  createCustomProcedure,
  listCustomDrugs,
  createCustomDrug
};

