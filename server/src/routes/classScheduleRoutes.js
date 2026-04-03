const express = require('express');
const { validate } = require('../utils/validate');
const { createClassScheduleSchema } = require('../validations/classScheduleValidation');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { getAllClassSchedules, getClassScheduleById, createClassSchedule, getClassSchedulesDebug } = require('../controllers/classScheduleController');

const router = express.Router();

router.post('/', requireRole([ROLES.ADMIN]), validate(createClassScheduleSchema), createClassSchedule);
router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllClassSchedules);
router.get('/debug', requireRole([ROLES.ADMIN]), getClassSchedulesDebug);
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getClassScheduleById);

module.exports = router;
