'use strict';
const { Router } = require('express');
const prisma = require('../../config/db');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');
const { success } = require('../../utils/response');

const router = Router();

router.use(authenticate);
router.use(authorize('super_admin'));

// GET /saas-invoices
router.get('/', async (req, res, next) => {
  try {
    const invoices = await prisma.saasInvoice.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return success(res, invoices, 'SaaS Invoices fetched successfully');
  } catch (err) {
    next(err);
  }
});

// POST /saas-invoices
router.post('/', async (req, res, next) => {
  try {
    const { clinicId, amount, issueDate, status, plan } = req.body;
    
    // Find clinic name
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    const clinicName = clinic ? clinic.name : 'Unknown Clinic';

    const invoice = await prisma.saasInvoice.create({
      data: {
        clinicId,
        clinicName,
        amount: Number(amount) || 0,
        issueDate: new Date(issueDate || new Date()),
        status: status || 'Unpaid',
        plan: plan || 'Basic',
      },
    });
    return success(res, invoice, 'SaaS Invoice created successfully', 201);
  } catch (err) {
    next(err);
  }
});

// PUT /saas-invoices/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, issueDate, status, plan } = req.body;
    
    const updated = await prisma.saasInvoice.update({
      where: { id },
      data: {
        ...(amount !== undefined && { amount: Number(amount) }),
        ...(issueDate && { issueDate: new Date(issueDate) }),
        ...(status && { status }),
        ...(plan && { plan }),
      },
    });
    return success(res, updated, 'SaaS Invoice updated successfully');
  } catch (err) {
    next(err);
  }
});

// DELETE /saas-invoices/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.saasInvoice.delete({ where: { id } });
    return success(res, { id }, 'SaaS Invoice deleted successfully');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
