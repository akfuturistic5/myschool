const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { getTimetableClass, getTimetableTeacher } = require('../controllers/classScheduleController');

const router = express.Router();

router.get('/class', requireRole(ALL_AUTHENTICATED_ROLES), getTimetableClass);
router.get('/teacher', requireRole(ALL_AUTHENTICATED_ROLES), getTimetableTeacher);

module.exports = router;
