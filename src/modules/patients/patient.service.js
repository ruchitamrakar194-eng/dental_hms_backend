'use strict';
const prisma = require('../../config/db');
const { hashPassword } = require('../../utils/hash');

/**
 * Format patient for API response — converts comma-separated allergies to array
 */
const formatPatient = (pat) => {
  if (!pat) return null;
  return {
    ...pat,
    allergies: pat.allergies
      ? pat.allergies.split(',').map((s) => s.trim()).filter(Boolean)
      : [],
  };
};

/**
 * List patients scoped by clinicId
 */
const listPatients = async ({ clinicId, userId, role }) => {
  const where = { clinicId };

  if (role === 'dentist') {
    where.appointments = {
      some: {
        OR: [
          { dentistId: userId },
          { assignedDoctorId: userId }
        ]
      }
    };
  } else if (role === 'hygienist') {
    where.appointments = {
      some: { assignedHygienistId: userId }
    };
  } else if (role === 'dental_assistant' || role === 'assistant') {
    where.appointments = {
      some: { assignedAssistantId: userId }
    };
  }

  const patients = await prisma.patient.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          clinicalNotes: true,
          xrayFiles: true
        }
      }
    }
  });

  const allPatientsSorted = await prisma.patient.findMany({
    where: { clinicId },
    orderBy: { createdAt: 'asc' },
    select: { id: true }
  });

  const idMap = {};
  allPatientsSorted.forEach((p, idx) => {
    idMap[p.id] = `pat-${idx + 1}`;
  });

  return patients.map(p => ({
    ...formatPatient(p),
    displayId: idMap[p.id] || p.id
  }));
};

/**
 * Get patient by ID and clinicId
 */
const getPatientById = async ({ id, clinicId }) => {
  const patient = await prisma.patient.findFirst({
    where: { id, clinicId },
    include: {
      odontogram: true,
      treatmentPlans: true,
      xrayFiles: true,
      prescriptions: true,
      clinicalNotes: {
        orderBy: {
          createdAt: 'desc'
        }
      }
    }
  });
  if (!patient) {
    throw Object.assign(new Error('Patient not found'), { statusCode: 404 });
  }

  // Resolve authors for clinical notes
  if (patient.clinicalNotes && patient.clinicalNotes.length > 0) {
    const authorIds = patient.clinicalNotes.map(n => n.authorId).filter(Boolean);
    if (authorIds.length > 0) {
      const authors = await prisma.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, name: true, role: true }
      });
      const authorMap = new Map(authors.map(a => [a.id, a]));
      patient.clinicalNotes = patient.clinicalNotes.map(n => ({
        ...n,
        authorName: authorMap.get(n.authorId)?.name || 'Unknown Staff',
        authorRole: authorMap.get(n.authorId)?.role || 'Staff'
      }));
    }
  }

  const allPatientsSorted = await prisma.patient.findMany({
    where: { clinicId },
    orderBy: { createdAt: 'asc' },
    select: { id: true }
  });

  const idx = allPatientsSorted.findIndex(p => p.id === patient.id);
  const displayId = idx !== -1 ? `pat-${idx + 1}` : 'pat-1';

  return {
    ...formatPatient(patient),
    displayId
  };
};

/**
 * Create a new patient
 */
const createPatient = async ({ clinicId, body }) => {
  const { name, age, gender, phone, email, status, address, allergies, insuranceProvider, vitals, history, password, medicalConditions, activeMedications } = body;

  // Enforce plan maxPatients limit
  if (clinicId) {
    const sub = await prisma.subscription.findUnique({
      where: { clinicId },
      include: { plan: true }
    });
    if (sub && sub.status === 'active') {
      const patientCount = await prisma.patient.count({ where: { clinicId } });
      if (patientCount >= sub.plan.maxPatients) {
        throw Object.assign(new Error(`Patient limit reached for your plan: ${sub.plan.name} (Max ${sub.plan.maxPatients} patients). Please upgrade your plan.`), { statusCode: 400 });
      }
    }
  }

  const allergyStr = Array.isArray(allergies)
    ? allergies.join(', ')
    : (allergies || '');

  let userId = null;

  if (email) {
    if (password) {
      // CASE 1: Email + Password provided (LOGIN ENABLED PATIENT)
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw Object.assign(new Error('Email is already registered'), { statusCode: 400 });
      }

      const hashedPassword = await hashPassword(password);
      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: 'patient',
          status: 'Approved',
          clinicId: clinicId || null,
        }
      });
      userId = user.id;
    }
    // CASE 2: Email provided BUT NO password -> userId remains null, created user is skipped
  }
  // CASE 3: No email -> userId remains null, created user is skipped

  const patient = await prisma.patient.create({
    data: {
      clinicId,
      name,
      age: Number(age) || 0,
      gender: gender || 'Other',
      phone,
      email: email || null,
      status: status || 'Inactive',
      address: address || '',
      allergies: allergyStr,
      insuranceProvider: insuranceProvider || 'None',
      vitals: vitals || '',
      history: history || '',
      userId,
      medicalConditions: medicalConditions ? (typeof medicalConditions === 'string' ? JSON.parse(medicalConditions) : medicalConditions) : null,
      activeMedications: activeMedications ? (typeof activeMedications === 'string' ? JSON.parse(activeMedications) : activeMedications) : null,
    },
  });

  return formatPatient(patient);
};

/**
 * Update an existing patient
 */
const updatePatient = async ({ id, clinicId, body }) => {
  const patient = await prisma.patient.findFirst({
    where: { id, clinicId },
  });
  if (!patient) {
    throw Object.assign(new Error('Patient not found'), { statusCode: 404 });
  }

  const { name, age, gender, phone, email, status, address, allergies, insuranceProvider, vitals, history, password, medicalConditions, activeMedications } = body;

  let newUserId = undefined;

  if (patient.userId) {
    // If email is changing, ensure uniqueness
    if (email && email !== patient.email) {
      const existing = await prisma.user.findFirst({
        where: {
          email,
          id: { not: patient.userId }
        }
      });
      if (existing) {
        throw Object.assign(new Error('Email is already registered'), { statusCode: 400 });
      }
    }

    const hashedPassword = password ? await hashPassword(password) : undefined;
    await prisma.user.update({
      where: { id: patient.userId },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(hashedPassword && { password: hashedPassword }),
      }
    });
  } else {
    // If patient has NO userId, but email (either updated or existing) + password are now provided:
    const activeEmail = email !== undefined ? email : patient.email;
    if (activeEmail && password) {
      const existing = await prisma.user.findUnique({ where: { email: activeEmail } });
      if (existing) {
        throw Object.assign(new Error('Email is already registered'), { statusCode: 400 });
      }

      const hashedPassword = await hashPassword(password);
      const user = await prisma.user.create({
        data: {
          name: name || patient.name,
          email: activeEmail,
          password: hashedPassword,
          role: 'patient',
          status: 'Approved',
          clinicId: clinicId || patient.clinicId || null,
        }
      });
      newUserId = user.id;
    }
  }

  const allergyStr = Array.isArray(allergies)
    ? allergies.join(', ')
    : allergies !== undefined
      ? allergies
      : undefined;

  const updated = await prisma.patient.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(age !== undefined && { age: Number(age) }),
      ...(gender && { gender }),
      ...(phone && { phone }),
      ...(email !== undefined && { email }),
      ...(status && { status }),
      ...(address !== undefined && { address }),
      ...(allergyStr !== undefined && { allergies: allergyStr }),
      ...(insuranceProvider !== undefined && { insuranceProvider }),
      ...(vitals !== undefined && { vitals }),
      ...(history !== undefined && { history }),
      ...(newUserId && { userId: newUserId }),
      ...(medicalConditions !== undefined && { medicalConditions: medicalConditions ? (typeof medicalConditions === 'string' ? JSON.parse(medicalConditions) : medicalConditions) : null }),
      ...(activeMedications !== undefined && { activeMedications: activeMedications ? (typeof activeMedications === 'string' ? JSON.parse(activeMedications) : activeMedications) : null }),
    },
  });

  return formatPatient(updated);
};

/**
 * Delete a patient
 */
const deletePatient = async ({ id, clinicId }) => {
  const patient = await prisma.patient.findFirst({
    where: { id, clinicId },
  });
  if (!patient) {
    throw Object.assign(new Error('Patient not found'), { statusCode: 404 });
  }

  if (patient.userId) {
    await prisma.refreshToken.deleteMany({ where: { userId: patient.userId } });
  }

  // Delete dependent tables to avoid foreign key violations
  await prisma.odontogram.deleteMany({ where: { patientId: id } });
  await prisma.appointment.deleteMany({ where: { patientId: id } });
  await prisma.treatmentPlan.deleteMany({ where: { patientId: id } });
  await prisma.xrayFile.deleteMany({ where: { patientId: id } });
  await prisma.prescription.deleteMany({ where: { patientId: id } });
  await prisma.clinicalNote.deleteMany({ where: { patientId: id } });
  await prisma.invoice.deleteMany({ where: { patientId: id } });
  await prisma.labCase.deleteMany({ where: { patientId: id } });

  await prisma.patient.delete({
    where: { id },
  });

  if (patient.userId) {
    try {
      await prisma.user.delete({ where: { id: patient.userId } });
    } catch (err) {
      console.error('Failed to delete user record:', err);
    }
  }

  return { id };
};

const updateOdontogram = async ({ patientId, clinicId, chartData }) => {
  const chartDataStr = typeof chartData === 'string' ? chartData : JSON.stringify(chartData);
  return prisma.odontogram.upsert({
    where: { patientId },
    update: { chartData: chartDataStr },
    create: { clinicId, patientId, chartData: chartDataStr }
  });
};

const createTreatmentPlan = async ({ patientId, clinicId, tooth, procedure, cost, status }) => {
  return prisma.treatmentPlan.create({
    data: {
      clinicId,
      patientId,
      tooth,
      procedure,
      cost: parseFloat(cost) || 0,
      status: status || 'Proposed'
    }
  });
};

const updateTreatmentPlan = async ({ planId, clinicId, status }) => {
  return prisma.treatmentPlan.update({
    where: { id: planId },
    data: { status }
  });
};

const deleteTreatmentPlan = async ({ planId, clinicId }) => {
  return prisma.treatmentPlan.delete({
    where: { id: planId }
  });
};

const createPrescription = async ({ patientId, clinicId, drug, dosage, frequency, duration }) => {
  return prisma.prescription.create({
    data: {
      clinicId,
      patientId,
      drug,
      dosage,
      frequency,
      duration,
      date: new Date()
    }
  });
};

const deletePrescription = async ({ rxId, clinicId }) => {
  return prisma.prescription.delete({
    where: { id: rxId }
  });
};

const createClinicalNote = async ({ patientId, clinicId, content, authorId }) => {
  return prisma.clinicalNote.create({
    data: {
      clinicId,
      patientId,
      content,
      authorId
    }
  });
};

const createXray = async ({ patientId, clinicId, name, notes, isScanned, aiReport, fileUrl, type }) => {
  const notePrefix = type ? `[${type}] ` : '';
  return prisma.xrayFile.create({
    data: {
      clinicId,
      patientId,
      name: name || 'radiograph_upload.jpg',
      date: new Date(),
      notes: `${notePrefix}${notes || ''}`.trim(),
      isScanned: isScanned || false,
      aiReport: aiReport || '',
      fileUrl: fileUrl || '',
    },
  });
};

const updateXray = async ({ xrayId, clinicId, isScanned, aiReport }) => {
  const xray = await prisma.xrayFile.findFirst({
    where: { id: xrayId, clinicId },
  });
  if (!xray) {
    throw Object.assign(new Error('X-ray not found'), { statusCode: 404 });
  }

  return prisma.xrayFile.update({
    where: { id: xrayId },
    data: {
      ...(isScanned !== undefined && { isScanned }),
      ...(aiReport !== undefined && { aiReport }),
    },
  });
};

const updatePerioChart = async ({ patientId, clinicId, perioChartData }) => {
  const patient = await prisma.patient.findFirst({ where: { id: patientId, clinicId } });
  if (!patient) throw Object.assign(new Error('Patient not found'), { statusCode: 404 });

  const serializedData = typeof perioChartData === 'object' && perioChartData !== null
    ? JSON.stringify(perioChartData)
    : perioChartData;

  return prisma.patient.update({
    where: { id: patientId },
    data: { perioChartData: serializedData }
  });
};

const updateRiskProfile = async ({ patientId, clinicId, riskProfileData }) => {
  const patient = await prisma.patient.findFirst({ where: { id: patientId, clinicId } });
  if (!patient) throw Object.assign(new Error('Patient not found'), { statusCode: 404 });

  const serializedData = typeof riskProfileData === 'object' && riskProfileData !== null
    ? JSON.stringify(riskProfileData)
    : riskProfileData;

  return prisma.patient.update({
    where: { id: patientId },
    data: { riskProfileData: serializedData }
  });
};

const listConsentForms = async ({ patientId, clinicId }) => {
  return prisma.consentForm.findMany({
    where: { patientId, clinicId },
    orderBy: { createdAt: 'desc' }
  });
};

const createConsentForm = async ({ patientId, clinicId, patientName, type, content }) => {
  return prisma.consentForm.create({
    data: {
      clinicId,
      patientId,
      patientName,
      type,
      status: 'Pending',
      content
    }
  });
};

const updateConsentForm = async ({ consentId, clinicId, signature, status, signedAt }) => {
  return prisma.consentForm.update({
    where: { id: consentId },
    data: {
      ...(signature && { signature }),
      ...(status && { status }),
      ...(signedAt && { signedAt: new Date(signedAt) })
    }
  });
};

const listProcedureTemplates = async ({ clinicId }) => {
  return prisma.procedureTemplate.findMany({
    where: { clinicId },
    orderBy: { title: 'asc' }
  });
};

const createProcedureTemplate = async ({ clinicId, title, content }) => {
  return prisma.procedureTemplate.create({
    data: {
      clinicId,
      title,
      content
    }
  });
};

const deleteProcedureTemplate = async ({ templateId, clinicId }) => {
  return prisma.procedureTemplate.delete({
    where: { id: templateId }
  });
};

const listCustomProcedures = async ({ clinicId }) => {
  return prisma.customProcedure.findMany({
    where: { clinicId },
    orderBy: { createdAt: 'asc' }
  });
};

const createCustomProcedure = async ({ clinicId, value, label, defaultCost }) => {
  return prisma.customProcedure.create({
    data: {
      clinicId,
      value,
      label,
      defaultCost
    }
  });
};

const listCustomDrugs = async ({ clinicId }) => {
  return prisma.customDrug.findMany({
    where: { clinicId },
    orderBy: { createdAt: 'asc' }
  });
};

const createCustomDrug = async ({ clinicId, value, label }) => {
  return prisma.customDrug.create({
    data: {
      clinicId,
      value,
      label
    }
  });
};

module.exports = {
  listPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
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


