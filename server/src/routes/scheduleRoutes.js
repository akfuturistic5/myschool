const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { getAllSchedules, getScheduleById, updateSchedule } = require('../controllers/scheduleController');

const router = express.Router();

router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllSchedules);
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getScheduleById);
router.put('/:id', requireRole([ROLES.ADMIN]), updateSchedule);

module.exports = router;
