const express = require('express');
const { validate } = require('../utils/validate');
const { createClassScheduleSchema, updateClassScheduleSchema } = require('../validations/classScheduleValidation');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  getAllClassSchedules, getClassScheduleById, createClassSchedule,
  updateClassSchedule, deleteClassSchedule, getClassSchedulesDebug
} = require('../controllers/classScheduleController');

const router = express.Router();

router.post('/', requireRole([ROLES.ADMIN]), validate(createClassScheduleSchema), createClassSchedule);
router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllClassSchedules);
router.get('/debug', requireRole([ROLES.ADMIN]), getClassSchedulesDebug);
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getClassScheduleById);
router.put('/:id', requireRole([ROLES.ADMIN]), validate(updateClassScheduleSchema), updateClassSchedule);
router.delete('/:id', requireRole([ROLES.ADMIN]), deleteClassSchedule);

module.exports = router;
