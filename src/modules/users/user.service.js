'use strict';
const prisma = require('../../config/db');
const { hashPassword } = require('../../utils/hash');

/**
 * List all users, optionally scoped by clinicId
 */
const listUsers = async ({ clinicId, role }) => {
  const where = clinicId ? { clinicId } : {};
  if (role) where.role = role;
  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      clinicId: true,
      name: true,
      email: true,
      role: true,
      status: true,
      avatarUrl: true,
      phone: true,
      speciality: true,
      assistantId: true,
      hygienistId: true,
      createdAt: true,
      updatedAt: true,
      clinic: {
        select: { id: true, name: true }
      }
    }
  });
  return users;
};

/**
 * Get user by ID
 */
const getUserById = async (id) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      clinicId: true,
      name: true,
      email: true,
      role: true,
      status: true,
      avatarUrl: true,
      phone: true,
      speciality: true,
      assistantId: true,
      hygienistId: true,
      createdAt: true,
      updatedAt: true,
      clinic: {
        select: { id: true, name: true }
      }
    }
  });
  if (!user) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }
  return user;
};

/**
 * Create a new user
 */
const createUser = async (body) => {
  const { name, email, password, role, status, clinicId, avatarUrl, phone, speciality, assistantId, hygienistId } = body;

  // Check unique email
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw Object.assign(new Error('Email is already registered'), { statusCode: 400 });
  }

  // Enforce plan maxUsers limit
  if (clinicId) {
    const sub = await prisma.subscription.findUnique({
      where: { clinicId },
      include: { plan: true }
    });
    if (sub && sub.status === 'active') {
      const userCount = await prisma.user.count({ where: { clinicId } });
      if (userCount >= sub.plan.maxUsers) {
        throw Object.assign(new Error(`User limit reached for your plan: ${sub.plan.name} (Max ${sub.plan.maxUsers} users/staff). Please upgrade your plan.`), { statusCode: 400 });
      }
    }
  }

  const hashedPassword = await hashPassword(password || '123456');

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role,
      status: status || 'Approved',
      clinicId: clinicId || null,
      avatarUrl: avatarUrl || null,
      phone: phone || null,
      speciality: speciality || null,
      assistantId: assistantId || null,
      hygienistId: hygienistId || null,
    },
    select: {
      id: true,
      clinicId: true,
      name: true,
      email: true,
      role: true,
      status: true,
      avatarUrl: true,
      phone: true,
      speciality: true,
      assistantId: true,
      hygienistId: true,
      createdAt: true,
    }
  });

  return user;
};

/**
 * Update an existing user
 */
const updateUser = async (id, body) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }

  const { name, email, password, role, status, clinicId, avatarUrl, phone, speciality, assistantId, hygienistId } = body;

  if (email && email !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw Object.assign(new Error('Email is already registered'), { statusCode: 400 });
    }
  }

  let hashedPassword;
  if (password) {
    hashedPassword = await hashPassword(password);
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(email && { email }),
      ...(hashedPassword && { password: hashedPassword }),
      ...(role && { role }),
      ...(status && { status }),
      ...(clinicId !== undefined && { clinicId }),
      ...(avatarUrl !== undefined && { avatarUrl }),
      ...(phone !== undefined && { phone }),
      ...(speciality !== undefined && { speciality }),
      ...(assistantId !== undefined && { assistantId }),
      ...(hygienistId !== undefined && { hygienistId }),
    },
    select: {
      id: true,
      clinicId: true,
      name: true,
      email: true,
      role: true,
      status: true,
      avatarUrl: true,
      phone: true,
      speciality: true,
      assistantId: true,
      hygienistId: true,
      createdAt: true,
      updatedAt: true,
    }
  });

  return updated;
};

/**
 * Delete a user
 */
const deleteUser = async (id) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }

  await prisma.refreshToken.deleteMany({ where: { userId: id } });
  await prisma.appointment.deleteMany({
    where: {
      OR: [
        { dentistId: id },
        { assignedTo: id }
      ]
    }
  });

  await prisma.user.delete({ where: { id } });

  return { id };
};

/**
 * Approve a user (Clinic Owner approval flow)
 */
const approveUser = async (id) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: { status: 'Approved' },
  });

  // If the user is a clinic owner, activate their clinic as well
  if (user.role === 'clinic_owner' && user.clinicId) {
    await prisma.clinic.update({
      where: { id: user.clinicId },
      data: { status: 'Active' },
    });
  }

  return updatedUser;
};

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  approveUser,
};
