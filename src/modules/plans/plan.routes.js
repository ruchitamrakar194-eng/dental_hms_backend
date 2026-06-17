'use strict';
const { Router } = require('express');
const prisma = require('../../config/db');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');
const { success } = require('../../utils/response');

const router = Router();

// GET /plans (Public endpoint for LandingPage pricing grid)
router.get('/', async (req, res, next) => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { price: 'asc' },
    });
    
    // Map backend fields to frontend interface expectations
    const formatted = plans.map((p) => ({
      id: p.id,
      name: p.name,
      fee: p.price,
      billingPeriod: p.billingPeriod,
      status: p.status,
      features: Array.isArray(p.features) ? p.features.join(', ') : (p.features || ''),
      maxClinics: p.maxClinics,
      maxUsers: p.maxUsers,
      maxPatients: p.maxPatients,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return success(res, formatted, 'Plans fetched successfully');
  } catch (err) {
    next(err);
  }
});

// Protect modifying routes for super_admin
router.use(authenticate);
router.use(authorize('super_admin'));

// POST /plans
router.post('/', async (req, res, next) => {
  try {
    const { name, fee, price, billingPeriod, status, features } = req.body;

    // Convert comma-separated features to JSON array of strings
    let featuresArray = [];
    if (typeof features === 'string') {
      featuresArray = features.split(',').map((f) => f.trim()).filter(Boolean);
    } else if (Array.isArray(features)) {
      featuresArray = features;
    }

    const planPrice = Number(fee !== undefined ? fee : price) || 0;

    const newPlan = await prisma.plan.create({
      data: {
        name,
        price: planPrice,
        billingPeriod: billingPeriod || 'Monthly',
        status: status || 'Active',
        features: featuresArray,
      },
    });

    const formatted = {
      id: newPlan.id,
      name: newPlan.name,
      fee: newPlan.price,
      billingPeriod: newPlan.billingPeriod,
      status: newPlan.status,
      features: Array.isArray(newPlan.features) ? newPlan.features.join(', ') : (newPlan.features || ''),
    };

    return success(res, formatted, 'SaaS subscription plan created successfully', 201);
  } catch (err) {
    next(err);
  }
});

// PUT /plans/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, fee, price, billingPeriod, status, features } = req.body;

    const target = await prisma.plan.findUnique({ where: { id } });
    if (!target) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    
    const finalPrice = fee !== undefined ? fee : price;
    if (finalPrice !== undefined) updateData.price = Number(finalPrice) || 0;

    if (billingPeriod !== undefined) updateData.billingPeriod = billingPeriod;
    if (status !== undefined) updateData.status = status;

    if (features !== undefined) {
      if (typeof features === 'string') {
        updateData.features = features.split(',').map((f) => f.trim()).filter(Boolean);
      } else if (Array.isArray(features)) {
        updateData.features = features;
      }
    }

    const updatedPlan = await prisma.plan.update({
      where: { id },
      data: updateData,
    });

    const formatted = {
      id: updatedPlan.id,
      name: updatedPlan.name,
      fee: updatedPlan.price,
      billingPeriod: updatedPlan.billingPeriod,
      status: updatedPlan.status,
      features: Array.isArray(updatedPlan.features) ? updatedPlan.features.join(', ') : (updatedPlan.features || ''),
    };

    return success(res, formatted, 'SaaS subscription plan updated successfully');
  } catch (err) {
    next(err);
  }
});

// DELETE /plans/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if plan exists
    const target = await prisma.plan.findUnique({ where: { id } });
    if (!target) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    await prisma.plan.delete({ where: { id } });
    return success(res, { id }, 'SaaS subscription plan deleted successfully');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
