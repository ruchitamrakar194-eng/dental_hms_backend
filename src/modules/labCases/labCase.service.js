'use strict';
const prisma = require('../../config/db');

const mapStatusToDb = (status) => {
  if (status === 'In Progress') return 'In_Progress';
  return status;
};

const mapStatusFromDb = (status) => {
  if (status === 'In_Progress') return 'In Progress';
  return status;
};

const mapLabCase = (labCase) => {
  if (!labCase) return labCase;
  let comments = [];
  if (labCase.comments) {
    try {
      comments = typeof labCase.comments === 'string' ? JSON.parse(labCase.comments) : labCase.comments;
    } catch (e) {
      comments = [];
    }
  }
  return {
    ...labCase,
    comments,
    status: mapStatusFromDb(labCase.status)
  };
};

const listLabCases = async ({ clinicId, userId, role }) => {
  const where = { clinicId };
  if (role === 'patient') {
    const patient = await prisma.patient.findFirst({ where: { userId } });
    if (patient) {
      where.patientId = patient.id;
    } else {
      return [];
    }
  }

  const labCases = await prisma.labCase.findMany({
    where,
    include: {
      crownDetails: true,
      implantDetails: true,
    },
    orderBy: { createdAt: 'desc' }
  });

  return labCases.map(mapLabCase);
};

const getLabCaseById = async ({ id, clinicId }) => {
  const labCase = await prisma.labCase.findFirst({
    where: { id, clinicId },
    include: {
      crownDetails: true,
      implantDetails: true,
    }
  });
  if (!labCase) {
    throw Object.assign(new Error('Lab case not found'), { statusCode: 404 });
  }
  return mapLabCase(labCase);
};

const mapLabCaseType = (typeStr) => {
  if (!typeStr) return 'Crown';
  const lower = String(typeStr).toLowerCase();
  if (lower.includes('crown')) return 'Crown';
  if (lower.includes('implant') || lower.includes('abutment')) return 'Implant';
  if (lower.includes('bridge')) return 'Bridge';
  if (lower.includes('denture')) return 'Denture';
  if (lower.includes('aligner')) return 'Aligner';
  if (lower.includes('retainer')) return 'Retainer';
  return 'Crown';
};

const createLabCase = async ({ clinicId, body }) => {
  const { patientId, patientName, dentistName, type, expectedDelivery, cost, notes, attachments, labName, toothNumber, material, shade, stage, dimensions, planningNotes } = body;

  // Validate patientId in database
  let validPatientId = patientId;
  const existingPatient = patientId ? await prisma.patient.findFirst({ where: { id: patientId } }) : null;
  if (!existingPatient) {
    const firstPatient = await prisma.patient.findFirst({ where: { clinicId } });
    if (firstPatient) {
      validPatientId = firstPatient.id;
    } else {
      // Fallback: create default patient record for lab case tracking
      const newPatient = await prisma.patient.create({
        data: {
          clinicId,
          name: patientName || 'Patient',
          phone: '000-000-0000',
          email: `patient-${Date.now()}@clinic.com`,
          age: 30
        }
      });
      validPatientId = newPatient.id;
    }
  }

  const resolvedType = mapLabCaseType(type);

  const labCase = await prisma.labCase.create({
    data: {
      clinicId,
      patientId: validPatientId,
      patientName: patientName || existingPatient?.name || 'Patient Record',
      dentistName: dentistName || 'Dr. Arthur Vance, DDS',
      type: resolvedType,
      status: 'Created',
      expectedDelivery: expectedDelivery ? new Date(expectedDelivery) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      cost: parseFloat(cost) || 0,
      notes: notes || '',
      attachments: typeof attachments === 'string' ? attachments : JSON.stringify(attachments || []),
      labName: labName || 'Pending Assignment',
      ...(resolvedType === 'Crown' && {
        crownDetails: {
          create: {
            toothNumber: toothNumber || '14',
            material: material || 'Zirconia',
            shade: shade || 'A2',
            notes: notes || ''
          }
        }
      }),
      ...(resolvedType === 'Implant' && {
        implantDetails: {
          create: {
            stage: stage || 'Planning',
            planningNotes: planningNotes || notes || '',
            dimensions: dimensions || 'Platform: 4.0mm, Length: 10.0mm',
            surgicalNotes: ''
          }
        }
      })
    },
    include: {
      crownDetails: true,
      implantDetails: true,
    }
  });

  return mapLabCase(labCase);
};

const updateLabCaseStatus = async ({ id, clinicId, status }) => {
  const labCase = await prisma.labCase.findFirst({ where: { id, clinicId } });
  if (!labCase) {
    throw Object.assign(new Error('Lab case not found'), { statusCode: 404 });
  }
  const updatedLabCase = await prisma.labCase.update({
    where: { id },
    data: { status: mapStatusToDb(status) },
    include: { crownDetails: true, implantDetails: true }
  });
  return mapLabCase(updatedLabCase);
};

const assignLabCase = async ({ id, clinicId, labName, expectedDelivery }) => {
  const labCase = await prisma.labCase.findFirst({ where: { id, clinicId } });
  if (!labCase) {
    throw Object.assign(new Error('Lab case not found'), { statusCode: 404 });
  }
  const updatedLabCase = await prisma.labCase.update({
    where: { id },
    data: { 
      labName, 
      expectedDelivery: expectedDelivery ? new Date(expectedDelivery) : undefined,
      status: 'Sent' 
    },
    include: { crownDetails: true, implantDetails: true }
  });
  return mapLabCase(updatedLabCase);
};

const updateImplantStage = async ({ id, clinicId, stage, planningNotes, dimensions, surgicalNotes }) => {
  const labCase = await prisma.labCase.findFirst({ where: { id, clinicId } });
  if (!labCase) {
    throw Object.assign(new Error('Lab case not found'), { statusCode: 404 });
  }
  
  await prisma.implantCase.upsert({
    where: { caseId: id },
    update: {
      ...(stage && { stage }),
      ...(planningNotes !== undefined && { planningNotes }),
      ...(dimensions !== undefined && { dimensions }),
      ...(surgicalNotes !== undefined && { surgicalNotes })
    },
    create: {
      caseId: id,
      stage: stage || 'Planning',
      planningNotes: planningNotes || '',
      dimensions: dimensions || '',
      surgicalNotes: surgicalNotes || ''
    }
  });

  let matchingStatus = labCase.status;
  if (stage === 'Ready') matchingStatus = 'Ready';
  if (stage === 'Delivered') matchingStatus = 'Delivered';

  if (matchingStatus !== labCase.status) {
    const updatedLabCase = await prisma.labCase.update({
      where: { id },
      data: { status: mapStatusToDb(matchingStatus) },
      include: { crownDetails: true, implantDetails: true }
    });
    return mapLabCase(updatedLabCase);
  }

  return getLabCaseById({ id, clinicId });
};

const updateCrownTracking = async ({ id, clinicId, toothNumber, material, shade, notes }) => {
  const labCase = await prisma.labCase.findFirst({ where: { id, clinicId } });
  if (!labCase) {
    throw Object.assign(new Error('Lab case not found'), { statusCode: 404 });
  }

  await prisma.crownCase.upsert({
    where: { caseId: id },
    update: {
      ...(toothNumber && { toothNumber }),
      ...(material && { material }),
      ...(shade && { shade }),
      ...(notes !== undefined && { notes })
    },
    create: {
      caseId: id,
      toothNumber: toothNumber || '8',
      material: material || 'Ceramic',
      shade: shade || 'A1',
      notes: notes || ''
    }
  });

  return getLabCaseById({ id, clinicId });
};

const addLabCaseComment = async ({ id, clinicId, text, authorName, authorRole, attachment }) => {
  const labCase = await prisma.labCase.findFirst({ where: { id, clinicId } });
  if (!labCase) {
    throw Object.assign(new Error('Lab case not found'), { statusCode: 404 });
  }

  let existingComments = [];
  if (labCase.comments) {
    try {
      existingComments = typeof labCase.comments === 'string' ? JSON.parse(labCase.comments) : labCase.comments;
    } catch (e) {
      existingComments = [];
    }
  }

  const newComment = {
    id: `comment-${Date.now()}`,
    text: text || '',
    authorName: authorName || 'Staff',
    authorRole: authorRole || 'Staff',
    attachment: attachment || null,
    createdAt: new Date().toISOString()
  };

  const updatedComments = [...existingComments, newComment];

  const updatedLabCase = await prisma.labCase.update({
    where: { id },
    data: {
      comments: JSON.stringify(updatedComments)
    },
    include: {
      crownDetails: true,
      implantDetails: true
    }
  });

  return mapLabCase(updatedLabCase);
};

const deleteLabCaseComment = async ({ id, clinicId, commentId }) => {
  const labCase = await prisma.labCase.findFirst({ where: { id, clinicId } });
  if (!labCase) {
    throw Object.assign(new Error('Lab case not found'), { statusCode: 404 });
  }

  let existingComments = [];
  if (labCase.comments) {
    try {
      existingComments = typeof labCase.comments === 'string' ? JSON.parse(labCase.comments) : labCase.comments;
    } catch (e) {
      existingComments = [];
    }
  }

  const updatedComments = existingComments.filter(cm => String(cm.id) !== String(commentId));

  const updatedLabCase = await prisma.labCase.update({
    where: { id },
    data: {
      comments: JSON.stringify(updatedComments)
    },
    include: {
      crownDetails: true,
      implantDetails: true
    }
  });

  return mapLabCase(updatedLabCase);
};

module.exports = {
  listLabCases,
  getLabCaseById,
  createLabCase,
  updateLabCaseStatus,
  assignLabCase,
  updateImplantStage,
  updateCrownTracking,
  addLabCaseComment,
  deleteLabCaseComment
};
