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
  return {
    ...labCase,
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

const createLabCase = async ({ clinicId, body }) => {
  const { patientId, patientName, dentistName, type, expectedDelivery, cost, notes, attachments, labName, toothNumber, material, shade, stage, dimensions, planningNotes } = body;

  const labCase = await prisma.labCase.create({
    data: {
      clinicId,
      patientId,
      patientName,
      dentistName,
      type,
      status: 'Created',
      expectedDelivery: new Date(expectedDelivery),
      cost: parseFloat(cost) || 0,
      notes: notes || '',
      attachments: typeof attachments === 'string' ? attachments : JSON.stringify(attachments || []),
      labName: labName || 'Pending Assignment',
      ...(type === 'Crown' && {
        crownDetails: {
          create: {
            toothNumber: toothNumber || '8',
            material: material || 'Ceramic',
            shade: shade || 'A1',
            notes: notes || ''
          }
        }
      }),
      ...(type === 'Implant' && {
        implantDetails: {
          create: {
            stage: stage || 'Planning',
            planningNotes: planningNotes || '',
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

module.exports = {
  listLabCases,
  getLabCaseById,
  createLabCase,
  updateLabCaseStatus,
  assignLabCase,
  updateImplantStage,
  updateCrownTracking
};
