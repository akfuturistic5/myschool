const express = require('express');
const { validate } = require('../utils/validate');
const { createClassScheduleSchema, updateClassScheduleSchema } = require('../validations/classScheduleValidation');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  getAllClassSchedules, getClassScheduleById, createClassSchedule,
  updateClassSchedule, deleteClassSchedule, getClassSchedulesDebug,
  bulkUpdateClassSchedules, copyClassSchedule, resetClassSchedule,
  getTimetableClass, getTimetableTeacher
} = require('../controllers/classScheduleController');

const router = express.Router();

router.post('/', requireRole([ROLES.ADMIN]), validate(createClassScheduleSchema), createClassSchedule);
router.post('/bulk', requireRole([ROLES.ADMIN]), bulkUpdateClassSchedules);
router.post('/copy', requireRole([ROLES.ADMIN]), copyClassSchedule);
router.post('/reset', requireRole([ROLES.ADMIN]), resetClassSchedule);
router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllClassSchedules);
router.get('/timetable/class', requireRole(ALL_AUTHENTICATED_ROLES), getTimetableClass);
router.get('/timetable/teacher', requireRole(ALL_AUTHENTICATED_ROLES), getTimetableTeacher);
router.get('/debug', requireRole([ROLES.ADMIN]), getClassSchedulesDebug);
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getClassScheduleById);
router.put('/:id', requireRole([ROLES.ADMIN]), validate(updateClassScheduleSchema), updateClassSchedule);
router.delete('/:id', requireRole([ROLES.ADMIN]), deleteClassSchedule);

module.exports = router;
