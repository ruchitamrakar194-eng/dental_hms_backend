'use strict';
const prisma = require('../../config/db');

/**
 * Maps an arbitrary input plan name to a valid ClinicPlan enum value.
 */
const mapToClinicPlan = (planName) => {
  if (!planName) return 'Basic';
  const name = planName.toLowerCase().trim();
  if (name.includes('trial') || name.includes('trail')) {
    return 'Trial';
  }
  if (name.includes('premium') || name === 'pro') {
    return 'Premium';
  }
  if (name.includes('enterprise')) {
    return 'Enterprise';
  }
  if (name.includes('basic')) {
    return 'Basic';
  }
  if (['Basic', 'Premium', 'Enterprise', 'Trial'].includes(planName)) {
    return planName;
  }
  return 'Basic';
};

/**
 * List all clinics (for Super Admin dashboard)
 */
const listClinics = async () => {
  const clinics = await prisma.clinic.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { patients: true }
      }
    }
  });
  return clinics.map(c => ({
    ...c,
    patients: c._count.patients,
    revenue: c.monthlyFee,
    aiModules: typeof c.aiModules === 'string' ? JSON.parse(c.aiModules) : (c.aiModules || {})
  }));
};

/**
 * Get clinic by ID
 */
const getClinicById = async (id) => {
  const clinic = await prisma.clinic.findUnique({
    where: { id },
    include: {
      _count: {
        select: { patients: true }
      }
    }
  });
  if (!clinic) {
    throw Object.assign(new Error('Clinic not found'), { statusCode: 404 });
  }
  return {
    ...clinic,
    patients: clinic._count.patients,
    revenue: clinic.monthlyFee,
    aiModules: typeof clinic.aiModules === 'string' ? JSON.parse(clinic.aiModules) : (clinic.aiModules || {})
  };
};

/**
 * Create a new clinic
 */
const createClinic = async (body) => {
  const { id, name, location, phone, status, plan, monthlyFee, performanceScore, aiModules } = body;
  
  const serializedAiModules = typeof aiModules === 'string'
    ? aiModules
    : JSON.stringify(aiModules || { diagnostic: false, recallSMS: false, workload: false });

  const clinic = await prisma.clinic.create({
    data: {
      ...(id && { id }),
      name,
      location,
      phone,
      status: status || 'Active',
      plan: mapToClinicPlan(plan),
      monthlyFee: monthlyFee !== undefined ? Number(monthlyFee) : 149.0,
      performanceScore: performanceScore !== undefined ? Number(performanceScore) : 85,
      aiModules: serializedAiModules,
    },
  });

  return {
    ...clinic,
    aiModules: typeof clinic.aiModules === 'string' ? JSON.parse(clinic.aiModules) : (clinic.aiModules || {})
  };
};

/**
 * Update clinic details
 */
const updateClinic = async (id, body) => {
  const clinic = await prisma.clinic.findUnique({
    where: { id },
  });
  if (!clinic) {
    throw Object.assign(new Error('Clinic not found'), { statusCode: 404 });
  }

  const { name, location, phone, status, plan, monthlyFee, performanceScore, aiModules } = body;

  const serializedAiModules = aiModules !== undefined
    ? (typeof aiModules === 'string' ? aiModules : JSON.stringify(aiModules))
    : undefined;

  let calculatedMonthlyFee = monthlyFee !== undefined ? Number(monthlyFee) : undefined;
  let targetPlanName = plan ? mapToClinicPlan(plan) : undefined;

  const oldPlanName = clinic.plan;
  const planChanged = targetPlanName && targetPlanName !== oldPlanName;
  let calculatedClinicStatus = status;

  if (planChanged) {
    const isTrial = targetPlanName === 'Trial' || targetPlanName === 'Trial Mode';
    calculatedClinicStatus = isTrial ? 'Trialing' : 'Suspended';
  }

  // If plan is updated, also update the clinic's Subscription to apply new limits instantly
  if (targetPlanName) {
    const dbPlan = await prisma.plan.findFirst({
      where: { name: { equals: targetPlanName } }
    });
    if (dbPlan) {
      if (calculatedMonthlyFee === undefined) {
        calculatedMonthlyFee = dbPlan.price;
      }
      await prisma.subscription.upsert({
        where: { clinicId: id },
        update: { planId: dbPlan.id, status: 'active' },
        create: {
          clinicId: id,
          planId: dbPlan.id,
          status: 'active',
        }
      });

      // Automatically generate a new unpaid SaaS invoice on plan changes
      if (planChanged) {
        const isTrial = targetPlanName === 'Trial' || targetPlanName === 'Trial Mode';
        await prisma.saasInvoice.create({
          data: {
            clinicId: id,
            clinicName: name || clinic.name,
            amount: dbPlan.price,
            issueDate: new Date(),
            status: isTrial ? 'Paid' : 'Unpaid',
            plan: targetPlanName,
          }
        });
      }
    }
  }

  const updated = await prisma.clinic.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(location && { location }),
      ...(phone && { phone }),
      ...(calculatedClinicStatus && { status: calculatedClinicStatus }),
      ...(targetPlanName && { plan: targetPlanName }),
      ...(calculatedMonthlyFee !== undefined && { monthlyFee: calculatedMonthlyFee }),
      ...(performanceScore !== undefined && { performanceScore: Number(performanceScore) }),
      ...(serializedAiModules !== undefined && { aiModules: serializedAiModules }),
    },
  });

  return {
    ...updated,
    aiModules: typeof updated.aiModules === 'string' ? JSON.parse(updated.aiModules) : (updated.aiModules || {})
  };
};

/**
 * Delete a clinic
 */
const deleteClinic = async (id) => {
  const clinic = await prisma.clinic.findUnique({
    where: { id },
  });
  if (!clinic) {
    throw Object.assign(new Error('Clinic not found'), { statusCode: 404 });
  }

  // 1. Delete patient-dependent records first
  const patientIds = (await prisma.patient.findMany({
    where: { clinicId: id },
    select: { id: true }
  })).map(p => p.id);

  if (patientIds.length > 0) {
    await prisma.odontogram.deleteMany({ where: { patientId: { in: patientIds } } });
    await prisma.treatmentPlan.deleteMany({ where: { patientId: { in: patientIds } } });
    await prisma.xrayFile.deleteMany({ where: { patientId: { in: patientIds } } });
    await prisma.clinicalNote.deleteMany({ where: { patientId: { in: patientIds } } });
    await prisma.prescription.deleteMany({ where: { patientId: { in: patientIds } } });
    await prisma.consentForm.deleteMany({ where: { patientId: { in: patientIds } } });
    await prisma.chairsideSession.deleteMany({ where: { patientId: { in: patientIds } } });
  }

  // 2. Delete clinic-level records referencing clinicId
  await prisma.appointment.deleteMany({ where: { clinicId: id } });
  
  await prisma.invoice.deleteMany({ where: { clinicId: id } });
  await prisma.labCase.deleteMany({ where: { clinicId: id } });
  await prisma.payment.deleteMany({ where: { clinicId: id } });
  await prisma.claim.deleteMany({ where: { clinicId: id } });
  await prisma.statement.deleteMany({ where: { clinicId: id } });
  
  await prisma.aiLog.deleteMany({ where: { clinicId: id } });
  await prisma.auditLog.deleteMany({ where: { clinicId: id } });
  await prisma.alert.deleteMany({ where: { clinicId: id } });
  
  await prisma.procedureTemplate.deleteMany({ where: { clinicId: id } });
  await prisma.customProcedure.deleteMany({ where: { clinicId: id } });
  await prisma.customDrug.deleteMany({ where: { clinicId: id } });

  // Delete patients after all patient-dependent clinic-level records are deleted
  await prisma.patient.deleteMany({ where: { clinicId: id } });


  // Delete all users of this clinic (and their refresh tokens, audit logs, AI logs, alerts)
  const userIds = (await prisma.user.findMany({
    where: { clinicId: id },
    select: { id: true }
  })).map(u => u.id);

  if (userIds.length > 0) {
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.aiLog.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.alert.deleteMany({ where: { userId: { in: userIds } } });
  }
  await prisma.user.deleteMany({ where: { clinicId: id } });

  // 3. Delete the clinic itself (cascade delete for Subscription, SaasInvoice, WaitlistItem, InsuranceCheck via DB)
  await prisma.clinic.delete({
    where: { id },
  });

  return { id };
};

/**
 * Toggle AI module status
 */
const toggleAiModule = async (id, { moduleName }) => {
  const clinic = await prisma.clinic.findUnique({
    where: { id },
  });
  if (!clinic) {
    throw Object.assign(new Error('Clinic not found'), { statusCode: 404 });
  }

  const currentModules = typeof clinic.aiModules === 'string'
    ? JSON.parse(clinic.aiModules)
    : (clinic.aiModules || {});

  const updatedModules = {
    ...currentModules,
    [moduleName]: !currentModules[moduleName],
  };

  const updated = await prisma.clinic.update({
    where: { id },
    data: { aiModules: JSON.stringify(updatedModules) },
  });

  return {
    ...updated,
    aiModules: updatedModules
  };
};

/**
 * Update clinic subscription plan and status
 */
const updateSubscription = async (id, { plan, status, monthlyFee }) => {
  const clinic = await prisma.clinic.findUnique({
    where: { id },
  });
  if (!clinic) {
    throw Object.assign(new Error('Clinic not found'), { statusCode: 404 });
  }

  const updated = await prisma.clinic.update({
    where: { id },
    data: {
      plan: mapToClinicPlan(plan),
      status,
      monthlyFee: monthlyFee !== undefined ? Number(monthlyFee) : clinic.monthlyFee,
    },
  });

  return {
    ...updated,
    aiModules: typeof updated.aiModules === 'string' ? JSON.parse(updated.aiModules) : (updated.aiModules || {})
  };
};

/**
 * Update clinic operational status
 */
const updateStatus = async (id, { status }) => {
  const clinic = await prisma.clinic.findUnique({
    where: { id },
  });
  if (!clinic) {
    throw Object.assign(new Error('Clinic not found'), { statusCode: 404 });
  }

  const updated = await prisma.clinic.update({
    where: { id },
    data: { status },
  });

  return {
    ...updated,
    aiModules: typeof updated.aiModules === 'string' ? JSON.parse(updated.aiModules) : (updated.aiModules || {})
  };
};

module.exports = {
  listClinics,
  getClinicById,
  createClinic,
  updateClinic,
  deleteClinic,
  toggleAiModule,
  updateSubscription,
  updateStatus,
};
