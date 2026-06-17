'use strict';
const { Router } = require('express');
const controller = require('./alert.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { clinicGuard } = require('../../middlewares/role.middleware');

const router = Router();

// Require auth and clinic scoping for all endpoints
router.use(authenticate);
router.use(clinicGuard);

router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:id/read', controller.markRead);
router.put('/read-all', controller.markAllRead);

module.exports = router;
