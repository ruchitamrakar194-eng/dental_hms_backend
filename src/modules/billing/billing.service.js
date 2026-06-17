'use strict';
const prisma = require('../../config/db');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_mock');

/**
 * Get current subscription details, active plan limits, and invoicing history for a clinic
 */
const getSubscriptionByClinicId = async (clinicId) => {
  // Fetch active subscription & plan limits
  const subscription = await prisma.subscription.findUnique({
    where: { clinicId },
    include: { plan: true }
  });

  // Fetch SaaS Invoices history
  const invoices = await prisma.saasInvoice.findMany({
    where: { clinicId },
    orderBy: { issueDate: 'desc' }
  });

  // Calculate user and patient counts for metrics
  const activeUsersCount = await prisma.user.count({ where: { clinicId } });
  const activePatientsCount = await prisma.patient.count({ where: { clinicId } });

  return {
    subscription,
    invoices,
    usage: {
      users: activeUsersCount,
      patients: activePatientsCount
    }
  };
};

/**
 * Create a Stripe Checkout Session for subscription plans
 */
const createCheckoutSession = async ({ clinicId, planId, successUrl, cancelUrl }) => {
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) {
    throw Object.assign(new Error('Selected plan not found'), { statusCode: 404 });
  }

  // Developer Mock Mode Fallback if Stripe key is mock/missing
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_mock') {
    console.log(`[Stripe Mock] Simulating checkout redirect for clinic ${clinicId} -> plan ${planId}`);
    const mockRedirectUrl = `${successUrl}?mock_checkout=true&clinicId=${clinicId}&planId=${planId}&amount=${plan.price}`;
    return { url: mockRedirectUrl, isMock: true };
  }

  // 1. Create or retrieve Stripe Customer
  let stripeCustomerId = null;
  const existingSub = await prisma.subscription.findUnique({ where: { clinicId } });
  if (existingSub && existingSub.stripeCustomerId) {
    stripeCustomerId = existingSub.stripeCustomerId;
  } else {
    const customer = await stripe.customers.create({
      email: `${clinic.id}@hms-saas.internal`,
      name: clinic.name,
      metadata: { clinicId }
    });
    stripeCustomerId = customer.id;
  }

  // 2. Generate Stripe Product Price dynamically if predefined ID is absent
  let stripePriceId = plan.id; // Fallback mapping
  if (plan.id === 'plan-basic') stripePriceId = process.env.STRIPE_PRICE_BASIC;
  if (plan.id === 'plan-pro') stripePriceId = process.env.STRIPE_PRICE_PRO;
  if (plan.id === 'plan-enterprise') stripePriceId = process.env.STRIPE_PRICE_ENTERPRISE;

  // If price ID is missing, create a temp one for developer convenience
  if (!stripePriceId || !stripePriceId.startsWith('price_')) {
    const product = await stripe.products.create({ name: `${plan.name} Plan` });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(plan.price * 100),
      currency: 'usd',
      recurring: { interval: 'month' }
    });
    stripePriceId = price.id;
  }

  // 3. Create Checkout Session
  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    payment_method_types: ['card'],
    line_items: [{ price: stripePriceId, quantity: 1 }],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      clinicId,
      planId
    }
  });

  return { url: session.url, isMock: false };
};

/**
 * Handle subscription creation/renewal in Database
 */
const activateSubscription = async ({ clinicId, planId, stripeCustomerId, stripeSubscriptionId, amountPaid }) => {
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) return;

  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
  if (!clinic) return;

  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 1); // 1 Month duration

  // 1. Upsert Subscription table
  await prisma.subscription.upsert({
    where: { clinicId },
    update: {
      planId,
      stripeCustomerId,
      stripeSubscriptionId,
      status: 'active',
      startDate,
      endDate
    },
    create: {
      clinicId,
      planId,
      stripeCustomerId,
      stripeSubscriptionId,
      status: 'active',
      startDate,
      endDate
    }
  });

  // 2. Sync Plan info directly on Clinic record (Legacy Compatibility)
  // Map 'plan-basic' -> Basic, etc.
  const planEnumMapping = {
    'plan-basic': 'Basic',
    'plan-pro': 'Premium', // mapped to legacy enum field Premium
    'plan-enterprise': 'Enterprise'
  };

  await prisma.clinic.update({
    where: { id: clinicId },
    data: {
      plan: planEnumMapping[planId] || 'Basic',
      status: 'Active',
      monthlyFee: plan.price
    }
  });

  // 3. Add SaaS Invoice Record
  await prisma.saasInvoice.create({
    data: {
      clinicId,
      clinicName: clinic.name,
      amount: amountPaid || plan.price,
      issueDate: new Date(),
      status: 'Paid',
      plan: plan.name
    }
  });

  console.log(`[SaaS Subscriptions] Successfully activated ${plan.name} plan for clinic ${clinic.name}`);
};

/**
 * Handle subscription cancellations/payment failures
 */
const deactivateSubscription = async (stripeSubscriptionId) => {
  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId }
  });
  if (!subscription) return;

  await prisma.subscription.update({
    where: { stripeSubscriptionId },
    data: { status: 'inactive' }
  });

  await prisma.clinic.update({
    where: { id: subscription.clinicId },
    data: { status: 'Suspended' }
  });

  console.log(`[SaaS Subscriptions] Suspended clinic ${subscription.clinicId} subscription (Stripe ID: ${stripeSubscriptionId})`);
};

const listInvoices = async (clinicId, userId, role) => {
  const where = { clinicId };
  if (role === 'patient') {
    const patient = await prisma.patient.findFirst({ where: { userId } });
    if (patient) {
      where.patientId = patient.id;
    } else {
      return [];
    }
  }
  return prisma.invoice.findMany({
    where,
    orderBy: { date: 'desc' }
  });
};

const createInvoice = async (clinicId, data) => {
  return prisma.invoice.create({
    data: {
      id: data.id || `inv-${Date.now()}`,
      clinicId,
      patientId: data.patientId,
      patientName: data.patientName,
      date: data.date ? new Date(data.date) : new Date(),
      dueDate: data.dueDate ? new Date(data.dueDate) : new Date(),
      amount: parseFloat(data.amount) || 0.0,
      tax: parseFloat(data.tax) || 0.0,
      discount: parseFloat(data.discount) || 0.0,
      insurancePaid: parseFloat(data.insurancePaid) || 0.0,
      patientPaid: parseFloat(data.patientPaid) || 0.0,
      status: data.status || 'Unpaid',
      items: typeof data.items === 'string' ? data.items : JSON.stringify(data.items || [])
    }
  });
};

const updateInvoice = async (clinicId, id, updates) => {
  // Convert numeric and date fields if present
  const data = { ...updates };
  if (updates.date) data.date = new Date(updates.date);
  if (updates.dueDate) data.dueDate = new Date(updates.dueDate);
  if (updates.amount !== undefined) data.amount = parseFloat(updates.amount);
  if (updates.tax !== undefined) data.tax = parseFloat(updates.tax);
  if (updates.discount !== undefined) data.discount = parseFloat(updates.discount);
  if (updates.insurancePaid !== undefined) data.insurancePaid = parseFloat(updates.insurancePaid);
  if (updates.patientPaid !== undefined) data.patientPaid = parseFloat(updates.patientPaid);
  if (updates.items !== undefined) {
    data.items = typeof updates.items === 'string' ? updates.items : JSON.stringify(updates.items);
  }

  await prisma.invoice.updateMany({
    where: { id, clinicId },
    data
  });
  return prisma.invoice.findFirst({ where: { id, clinicId } });
};

const deleteInvoice = async (clinicId, id) => {
  return prisma.invoice.deleteMany({
    where: { id, clinicId }
  });
};

const listPayments = async (clinicId) => {
  return prisma.payment.findMany({
    where: { clinicId },
    orderBy: { date: 'desc' }
  });
};

const createPayment = async (clinicId, data) => {
  const payment = await prisma.payment.create({
    data: {
      id: data.id || `pay-${Date.now()}`,
      clinicId,
      invoiceId: data.invoiceId,
      patientName: data.patientName,
      amount: parseFloat(data.amount) || 0.0,
      method: data.method,
      date: data.date ? new Date(data.date) : new Date(),
      note: data.note || ''
    }
  });

  // Re-calculate linked invoice balances
  const invoice = await prisma.invoice.findFirst({ where: { id: data.invoiceId, clinicId } });
  if (invoice) {
    let newPatientPaid = invoice.patientPaid;
    let newInsurancePaid = invoice.insurancePaid;
    if (data.method === 'Insurance') {
      newInsurancePaid += parseFloat(data.amount);
    } else {
      newPatientPaid += parseFloat(data.amount);
    }
    const totalPaid = newPatientPaid + newInsurancePaid;
    const newStatus = totalPaid >= invoice.amount ? 'Paid' : 'Partial';
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        patientPaid: newPatientPaid,
        insurancePaid: newInsurancePaid,
        status: newStatus
      }
    });
  }

  return payment;
};

const deletePayment = async (clinicId, id) => {
  const payment = await prisma.payment.findFirst({ where: { id, clinicId } });
  if (!payment) return { count: 0 };

  const invoice = await prisma.invoice.findFirst({ where: { id: payment.invoiceId, clinicId } });
  if (invoice) {
    let newPatientPaid = invoice.patientPaid;
    let newInsurancePaid = invoice.insurancePaid;
    if (payment.method === 'Insurance') {
      newInsurancePaid = Math.max(0.0, newInsurancePaid - payment.amount);
    } else {
      newPatientPaid = Math.max(0.0, newPatientPaid - payment.amount);
    }
    const totalPaid = newPatientPaid + newInsurancePaid;
    const newStatus = totalPaid === 0 ? 'Unpaid' : totalPaid >= invoice.amount ? 'Paid' : 'Partial';
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        patientPaid: newPatientPaid,
        insurancePaid: newInsurancePaid,
        status: newStatus
      }
    });
  }

  return prisma.payment.deleteMany({
    where: { id, clinicId }
  });
};

const listClaims = async (clinicId) => {
  return prisma.claim.findMany({
    where: { clinicId },
    orderBy: { submittedDate: 'desc' }
  });
};

const createClaim = async (clinicId, data) => {
  return prisma.claim.create({
    data: {
      id: data.id || `clm-${Date.now()}`,
      clinicId,
      invoiceId: data.invoiceId,
      patientName: data.patientName,
      carrier: data.carrier,
      claimAmount: parseFloat(data.claimAmount) || 0.0,
      approvedAmount: parseFloat(data.approvedAmount) || 0.0,
      submittedDate: data.submittedDate ? new Date(data.submittedDate) : new Date(),
      status: data.status || 'Pending',
      note: data.note || ''
    }
  });
};

const updateClaimStatus = async (clinicId, id, status, approvedAmount) => {
  await prisma.claim.updateMany({
    where: { id, clinicId },
    data: {
      status,
      ...(approvedAmount !== undefined && { approvedAmount: parseFloat(approvedAmount) })
    }
  });
  return prisma.claim.findFirst({ where: { id, clinicId } });
};

const deleteClaim = async (clinicId, id) => {
  return prisma.claim.deleteMany({
    where: { id, clinicId }
  });
};

const listStatements = async (clinicId) => {
  return prisma.statement.findMany({
    where: { clinicId },
    orderBy: { generatedDate: 'desc' }
  });
};

const createStatement = async (clinicId, data) => {
  return prisma.statement.create({
    data: {
      id: data.id || `stmt-${Date.now()}`,
      clinicId,
      patientId: data.patientId,
      patientName: data.patientName,
      generatedDate: new Date(),
      periodStart: new Date(data.periodStart),
      periodEnd: new Date(data.periodEnd),
      totalBilled: parseFloat(data.totalBilled) || 0.0,
      totalPaid: parseFloat(data.totalPaid) || 0.0,
      balance: parseFloat(data.balance) || 0.0
    }
  });
};

const deleteStatement = async (clinicId, id) => {
  return prisma.statement.deleteMany({
    where: { id, clinicId }
  });
};

module.exports = {
  getSubscriptionByClinicId,
  createCheckoutSession,
  activateSubscription,
  deactivateSubscription,
  listInvoices,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  listPayments,
  createPayment,
  deletePayment,
  listClaims,
  createClaim,
  updateClaimStatus,
  deleteClaim,
  listStatements,
  createStatement,
  deleteStatement
};
