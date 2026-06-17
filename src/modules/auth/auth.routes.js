'use strict';
const { Router } = require('express');
const { body } = require('express-validator');
const controller = require('./auth.controller');
const { authenticate } = require('../../middlewares/auth.middleware');

const router = Router();

// Validation rules
const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').notEmpty().withMessage('Role is required').isIn([
    'super_admin', 'clinic_owner', 'dentist', 'hygienist',
    'front_desk', 'billing_staff', 'lab_coordinator', 'dental_assistant', 'patient'
  ]).withMessage('Invalid role'),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required'),
];

// ─── PUBLIC ROUTES ────────────────────────────────────────────────────────────

// POST /api/v1/auth/register
router.post('/register', registerValidation, controller.register);

// POST /api/v1/auth/login
router.post('/login', loginValidation, controller.login);

// POST /api/v1/auth/refresh
router.post('/refresh', controller.refreshToken);

// PUBLIC: Register a full clinic + owner in one shot (no auth required)
// POST /api/v1/auth/register-clinic
router.post('/register-clinic', controller.registerClinic);

// PUBLIC: Register a patient from the landing page (no auth required)
// POST /api/v1/auth/register-patient
router.post('/register-patient', controller.registerPatient);

// PUBLIC: Fetch active clinics for registry selection (no auth required)
// GET /api/v1/auth/public-clinics
router.get('/public-clinics', controller.listClinicsPublic);

// ─── PROTECTED ROUTES ─────────────────────────────────────────────────────────

// POST /api/v1/auth/logout
router.post('/logout', authenticate, controller.logout);

// GET /api/v1/auth/me
router.get('/me', authenticate, controller.getMe);

module.exports = router;
