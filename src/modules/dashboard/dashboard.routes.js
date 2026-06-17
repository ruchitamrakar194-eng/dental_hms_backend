'use strict';
const { Router } = require('express');
const controller = require('./dashboard.controller');

const router = Router();

router.get('/stats', controller.getStats);
router.get('/insights', controller.getInsights);

module.exports = router;
