'use strict';
const { validationResult } = require('express-validator');
const authService = require('./auth.service');
const clinicService = require('../clinics/clinic.service');
const userService = require('../users/user.service');
const prisma = require('../../config/db');
const { hashPassword } = require('../../utils/hash');
const { success, error, validationError } = require('../../utils/response');

const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return validationError(res, errors.array());

    const { name, email, password, role, clinicId, avatarUrl } = req.body;
    const result = await authService.register({ name, email, password, role, clinicId, avatarUrl });

    return success(res, result, result.message, 201);
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return validationError(res, errors.array());

    const { email, password } = req.body;
    const result = await authService.login({ email, password });

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return success(res, {
      accessToken: result.accessToken,
      user: result.user,
    }, 'Login successful');
  } catch (err) {
    next(err);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    // Accept from cookie OR body (for React Native / non-browser clients)
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    const result = await authService.refreshAccessToken(token);

    return success(res, result, 'Token refreshed');
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    await authService.logout(token, req.user?.id);

    res.clearCookie('refreshToken');
    return success(res, {}, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
};

const getMe = async (req, res, next) => {
  try {
    const profile = await authService.getMe(req.user.id);
    return success(res, profile, 'Profile fetched');
  } catch (err) {
    next(err);
  }
};

/**
 * PUBLIC: Register a new clinic + clinic owner in a single request
 * POST /api/v1/auth/register-clinic
 */
const registerClinic = async (req, res, next) => {
  try {
    const { clinicName, location, phone, ownerName, ownerEmail, ownerPassword, plan } = req.body;

    if (!clinicName || !location || !ownerName || !ownerEmail || !ownerPassword) {
      return error(res, 'All required fields must be provided', 400);
    }

    // Check if owner email is already taken
    const existing = await prisma.user.findUnique({ where: { email: ownerEmail } });
    if (existing) {
      return error(res, 'Email is already registered', 400);
    }

    // Lookup plan monthly fee from database
    let selectedPlanName = plan || 'Trial';
    let monthlyFee = 0;
    if (selectedPlanName && selectedPlanName !== 'Trial' && selectedPlanName !== 'Trial Mode') {
      const dbPlan = await prisma.plan.findFirst({ where: { name: { equals: selectedPlanName } } });
      if (dbPlan) {
        monthlyFee = dbPlan.price;
      }
    }

    // 1. Create the clinic first (Trialing status, no auth required)
    const clinic = await clinicService.createClinic({
      name: clinicName,
      location,
      phone: phone || '',
      plan: selectedPlanName,
      status: selectedPlanName === 'Trial' || selectedPlanName === 'Trial Mode' ? 'Trialing' : 'Active',
      monthlyFee,
      performanceScore: 80,
      aiModules: { diagnostic: false, recallSMS: false, workload: false },
    });

    // 2. Create clinic_owner user linked to new clinic (Approved status)
    const hashedPwd = await hashPassword(ownerPassword);
    const owner = await prisma.user.create({
      data: {
        name: ownerName,
        email: ownerEmail,
        password: hashedPwd,
        role: 'clinic_owner',
        clinicId: clinic.id,
        status: 'Approved',
      },
      select: { id: true, name: true, email: true, role: true, clinicId: true, status: true },
    });

    return success(res, { clinic, owner }, 'Clinic registered successfully.', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * PUBLIC: Register a patient record (no auth required)
 * POST /api/v1/auth/register-patient
 */
const registerPatient = async (req, res, next) => {
  try {
    const { name, email, phone, age, gender, address, allergies, insuranceProvider, clinicId, password } = req.body;

    if (!name || !phone || !email) {
      return error(res, 'Name, phone, and email are required', 400);
    }

    // Verify clinic exists
    if (clinicId) {
      const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
      if (!clinic) {
        return error(res, 'Selected clinic not found', 404);
      }
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return error(res, 'Email is already registered', 400);
    }

    // Create linked User account for login
    const hashedPwd = await hashPassword(password || '123456');
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPwd,
        role: 'patient',
        status: 'Approved',
        clinicId: clinicId || null,
      }
    });

    // Format allergies (array → comma-separated string for storage, or keep as is)
    const allergyStr = Array.isArray(allergies)
      ? allergies.join(', ')
      : (allergies || 'None');

    const patient = await prisma.patient.create({
      data: {
        name,
        email: email || null,
        phone,
        age: Number(age) || 0,
        gender: gender || 'Other',
        address: address || null,
        allergies: allergyStr,
        insuranceProvider: insuranceProvider || 'None',
        status: 'Active',
        clinicId: clinicId || null,
        userId: user.id,
      },
    });

    return success(res, patient, 'Patient registered successfully', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * PUBLIC: List active clinics for registration dropdown
 * GET /api/v1/auth/public-clinics
 */
const listClinicsPublic = async (req, res, next) => {
  try {
    const clinics = await prisma.clinic.findMany({
      where: { status: 'Active' },
      select: { id: true, name: true, location: true, phone: true, status: true }
    });
    return success(res, clinics, 'Public clinics list fetched successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, refreshToken, logout, getMe, registerClinic, registerPatient, listClinicsPublic };
