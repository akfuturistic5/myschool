const express = require('express');
const Joi = require('joi');
const { validate } = require('../utils/validate');
const { requireRole } = require('../middleware/rbacMiddleware');
const {
  saveAttendance,
  updateAttendance,
  getMarkingRoster,
  getAttendanceReport,
  getAttendanceDayWise,
  getMyAttendance,
} = require('../controllers/attendanceController');
const { ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  upsertAttendanceSchema,
  reportQuerySchema: reportQuerySchemaWithEntity,
  dayWiseQuerySchema: dayWiseQuerySchemaWithEntity,
  ENTITY_TYPES,
} = require('../validations/attendanceValidation');

const router = express.Router();

const attendanceQuerySchema = Joi.object({
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  class_id: Joi.number().integer().positive().allow(null, ''),
  section_id: Joi.number().integer().positive().allow(null, ''),
  department_id: Joi.number().integer().positive().allow(null, ''),
  designation_id: Joi.number().integer().positive().allow(null, ''),
  academic_year_id: Joi.number().integer().positive().allow(null, ''),
});

const entityTypeParamSchema = Joi.object({
  entityType: Joi.string().trim().lowercase().valid(...ENTITY_TYPES).required(),
});

const myAttendanceQuerySchema = Joi.object({
  days: Joi.number().integer().min(1).max(365).allow(null, ''),
  academic_year_id: Joi.number().integer().positive().allow(null, ''),
});

router.get(
  '/me',
  requireRole(ALL_AUTHENTICATED_ROLES),
  validate(myAttendanceQuerySchema, 'query'),
  getMyAttendance
);

router.post(
  '/',
  requireRole([ROLES.ADMIN, ROLES.ADMINISTRATIVE, ROLES.TEACHER]),
  validate(upsertAttendanceSchema),
  saveAttendance
);
router.put(
  '/',
  requireRole([ROLES.ADMIN, ROLES.ADMINISTRATIVE, ROLES.TEACHER]),
  validate(upsertAttendanceSchema),
  updateAttendance
);

router.get(
  '/marking/:entityType',
  requireRole([ROLES.ADMIN, ROLES.ADMINISTRATIVE, ROLES.TEACHER]),
  validate(entityTypeParamSchema, 'params'),
  validate(attendanceQuerySchema, 'query'),
  getMarkingRoster
);

router.get(
  '/reports/:entityType',
  requireRole([ROLES.ADMIN, ROLES.ADMINISTRATIVE, ROLES.TEACHER]),
  validate(entityTypeParamSchema, 'params'),
  validate(reportQuerySchemaWithEntity.keys({ entityType: Joi.any().forbidden() }), 'query'),
  getAttendanceReport
);

router.get(
  '/day-wise/:entityType',
  requireRole([ROLES.ADMIN, ROLES.ADMINISTRATIVE, ROLES.TEACHER]),
  validate(entityTypeParamSchema, 'params'),
  validate(dayWiseQuerySchemaWithEntity.keys({ entityType: Joi.any().forbidden() }), 'query'),
  getAttendanceDayWise
);

module.exports = router;
