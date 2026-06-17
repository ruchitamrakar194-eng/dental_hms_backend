'use strict';
const { Router } = require('express');
const prisma = require('../../config/db');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');
const { success } = require('../../utils/response');

const router = Router();

router.use(authenticate);
router.use(authorize('super_admin', 'clinic_owner'));

// GET /audit-logs
router.get('/', async (req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
      include: {
        user: {
          select: { name: true }
        }
      }
    });

    // Format logs to match frontend structure: { id, timestamp, user, action, clinic }
    const formattedLogs = logs.map(l => ({
      id: l.id,
      timestamp: l.timestamp.toISOString().replace('T', ' ').substring(0, 16),
      user: l.user ? l.user.name : 'System',
      action: l.action,
      clinic: l.clinic || 'Global'
    }));

    return success(res, formattedLogs, 'Audit logs fetched successfully');
  } catch (err) {
    next(err);
  }
});

// POST /audit-logs
router.post('/', async (req, res, next) => {
  try {
    const { action, clinic } = req.body;
    const log = await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action,
        clinic: clinic || 'Global',
        timestamp: new Date()
      }
    });
    return success(res, log, 'Audit log recorded successfully', 201);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
