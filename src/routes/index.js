'use strict';
const { Router } = require('express');

const authRoutes = require('../modules/auth/auth.routes');
const appointmentRoutes = require('../modules/appointments/appointment.routes');
const patientRoutes = require('../modules/patients/patient.routes');
const clinicRoutes = require('../modules/clinics/clinic.routes');
const userRoutes = require('../modules/users/user.routes');
const saasInvoiceRoutes = require('../modules/saasInvoices/saasInvoice.routes');
const planRoutes = require('../modules/plans/plan.routes');
const auditLogRoutes = require('../modules/auditLogs/auditLog.routes');
const alertRoutes = require('../modules/alerts/alert.routes');
const billingRoutes = require('../modules/billing/billing.routes');
const aiRoutes = require('../modules/ai/ai.routes');
const dashboardRoutes = require('../modules/dashboard/dashboard.routes');
const waitlistRoutes = require('../modules/waitlist/waitlist.routes');
const insuranceCheckRoutes = require('../modules/insuranceChecks/insuranceCheck.routes');
const labCaseRoutes = require('../modules/labCases/labCase.routes');

const { requireActiveSubscription } = require('../middlewares/subscription.middleware');
const { authenticate } = require('../middlewares/auth.middleware');

const router = Router();

// ─── API v1 ROUTES ────────────────────────────────────────────────────────────

router.use('/auth', authRoutes);
router.use('/billing', billingRoutes);

// Protected Scoped Clinic Data Endpoints
router.use('/appointments', authenticate, requireActiveSubscription, appointmentRoutes);
router.use('/patients', authenticate, requireActiveSubscription, patientRoutes);
router.use('/users', authenticate, requireActiveSubscription, userRoutes);
router.use('/ai', authenticate, requireActiveSubscription, aiRoutes);
router.use('/dashboard', authenticate, requireActiveSubscription, dashboardRoutes);
router.use('/waitlist', authenticate, requireActiveSubscription, waitlistRoutes);
router.use('/insurance-checks', authenticate, requireActiveSubscription, insuranceCheckRoutes);
router.use('/lab-cases', authenticate, requireActiveSubscription, labCaseRoutes);

// Platform Management Endpoints
router.use('/clinics', clinicRoutes);
router.use('/saas-invoices', saasInvoiceRoutes);
router.use('/plans', planRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/alerts', alertRoutes);

module.exports = router;
