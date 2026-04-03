const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { fetchStudentForBonafide } = require('../controllers/bonafideController');

const router = express.Router();

router.post('/fetch-student', requireRole(ALL_AUTHENTICATED_ROLES), fetchStudentForBonafide);

module.exports = router;
