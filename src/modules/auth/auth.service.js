'use strict';
const prisma = require('../../config/db');
const { hashPassword, comparePassword } = require('../../utils/hash');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../../utils/jwt');
const { CLINIC_SCOPED_ROLES } = require('../../constants/roles');

/**
 * Build auth profile payload — matches frontend authStore user shape EXACTLY
 * { id, name, email, role, clinicId, avatarUrl, status, patientId }
 */
const buildProfile = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  clinicId: user.clinicId || null,
  avatarUrl: user.avatarUrl || null,
  status: user.status,
  patientId: user.patientProfile?.id || null,
  clinic: user.clinic ? {
    ...user.clinic,
    aiModules: typeof user.clinic.aiModules === 'string' ? JSON.parse(user.clinic.aiModules) : (user.clinic.aiModules || {})
  } : null,
});

/**
 * REGISTER — Create new user account
 * Super admin auto-approved; clinic-scoped roles need super_admin approval
 */
const register = async ({ name, email, password, role, clinicId, avatarUrl }) => {
  // Validate clinic exists if role requires it
  if (CLINIC_SCOPED_ROLES.includes(role) && !clinicId) {
    throw Object.assign(new Error('clinicId is required for this role'), { statusCode: 400 });
  }

  if (clinicId) {
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) {
      throw Object.assign(new Error('Clinic not found'), { statusCode: 404 });
    }
  }

  const hashedPwd = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPwd,
      role,
      clinicId: clinicId || null,
      avatarUrl: avatarUrl || null,
      // Super admin auto-approved; others need approval
      status: role === 'super_admin' ? 'Approved' : 'Pending_Approval',
    },
  });

  return {
    user: buildProfile(user),
    message: role === 'super_admin'
      ? 'Super admin account created successfully'
      : 'Registration submitted. Awaiting super admin approval.',
  };
};

/**
 * LOGIN — Verify credentials, return tokens + profile
 */
const login = async ({ email, password }) => {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { patientProfile: true, clinic: true }
  });

  if (!user) {
    throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
  }

  const isMatch = await comparePassword(password, user.password);
  if (!isMatch) {
    throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
  }

  if (user.status === 'Pending_Approval') {
    throw Object.assign(new Error('Account pending approval by Super Admin'), { statusCode: 403 });
  }

  if (user.status === 'Suspended') {
    throw Object.assign(new Error('Account suspended. Contact administrator.'), { statusCode: 403 });
  }

  if (user.clinic && user.clinic.status === 'Suspended') {
    throw Object.assign(new Error("Your clinic's account is suspended. Please contact the administrator."), { statusCode: 403 });
  }

  const tokenPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
    clinicId: user.clinicId,
  };

  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  // Store refresh token in DB
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt,
    },
  });

  return {
    accessToken,
    refreshToken,
    user: buildProfile(user),
  };
};

/**
 * REFRESH TOKEN — Issue new access token
 */
const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) {
    throw Object.assign(new Error('Refresh token required'), { statusCode: 400 });
  }

  // Verify signature
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw Object.assign(new Error('Invalid or expired refresh token'), { statusCode: 401 });
  }

  // Check token exists in DB (not revoked)
  const stored = await prisma.refreshToken.findFirst({
    where: { token: refreshToken, userId: decoded.id },
  });

  if (!stored) {
    throw Object.assign(new Error('Refresh token revoked or not found'), { statusCode: 401 });
  }

  if (new Date() > stored.expiresAt) {
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    throw Object.assign(new Error('Refresh token expired'), { statusCode: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    include: { patientProfile: true, clinic: true }
  });
  if (!user) {
    throw Object.assign(new Error('User not found'), { statusCode: 401 });
  }

  const newAccessToken = signAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
    clinicId: user.clinicId,
  });

  return { accessToken: newAccessToken, user: buildProfile(user) };
};

/**
 * LOGOUT — Revoke refresh token
 */
const logout = async (refreshToken, userId) => {
  if (!refreshToken) return;

  await prisma.refreshToken.deleteMany({
    where: {
      token: refreshToken,
      userId,
    },
  });
};

/**
 * GET ME — Return current user profile
 */
const getMe = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      clinic: true,
      patientProfile: true
    },
  });

  if (!user) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }

  return buildProfile(user);
};

module.exports = { register, login, refreshAccessToken, logout, getMe };
