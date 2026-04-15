const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { validate } = require('../utils/validate');
const { ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { scheduleCreateSchema, scheduleUpdateSchema } = require('../validations/scheduleValidation');
const { getAllSchedules, getScheduleById, createSchedule, updateSchedule, deleteSchedule } = require('../controllers/scheduleController');

const router = express.Router();

router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllSchedules);
router.post('/', requireRole([ROLES.ADMIN]), validate(scheduleCreateSchema), createSchedule);
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getScheduleById);
router.put('/:id', requireRole([ROLES.ADMIN]), validate(scheduleUpdateSchema), updateSchedule);
router.delete('/:id', requireRole([ROLES.ADMIN]), deleteSchedule);

module.exports = router;
