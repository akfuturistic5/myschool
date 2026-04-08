const express = require('express');
const { requireRoleName } = require('../middleware/rbacMiddleware');
const { getMyDriverPortal } = require('../controllers/driverPortalController');

const router = express.Router();

router.get('/me', requireRoleName(['driver']), getMyDriverPortal);

module.exports = router;
