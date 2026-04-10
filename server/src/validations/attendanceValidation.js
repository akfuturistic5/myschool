const Joi = require('joi');

const ENTITY_TYPES = ['student', 'staff'];
const STATUS_TYPES = ['present', 'absent', 'late', 'half_day', 'holiday'];

const parseDate = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .custom((value, helpers) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      return helpers.error('any.invalid');
    }
    const today = new Date();
    const utcToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    if (parsed > utcToday) {
      return helpers.message('attendanceDate cannot be in the future');
    }
    return value;
  })
  .required();

const attendanceRecordSchema = Joi.object({
  entityId: Joi.number().integer().positive().required(),
  status: Joi.string().trim().lowercase().valid(...STATUS_TYPES).required(),
  checkInTime: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).allow(null, ''),
  checkOutTime: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).allow(null, ''),
  remark: Joi.string().trim().max(500).allow(null, ''),
  classId: Joi.number().integer().positive().allow(null),
  sectionId: Joi.number().integer().positive().allow(null),
  departmentId: Joi.number().integer().positive().allow(null),
  designationId: Joi.number().integer().positive().allow(null),
}).when(Joi.object({}).unknown(), {
  then: Joi.object({
    classId: Joi.when(Joi.ref('/entityType'), {
      is: 'student',
      then: Joi.number().integer().positive().required(),
      otherwise: Joi.number().integer().positive().allow(null),
    }),
    sectionId: Joi.when(Joi.ref('/entityType'), {
      is: 'student',
      then: Joi.number().integer().positive().required(),
      otherwise: Joi.number().integer().positive().allow(null),
    }),
  }),
});

const upsertAttendanceSchema = Joi.object({
  entityType: Joi.string().trim().lowercase().valid(...ENTITY_TYPES).required(),
  attendanceDate: parseDate,
  academicYearId: Joi.number().integer().positive().allow(null),
  records: Joi.array().items(attendanceRecordSchema).min(1).required(),
});

const reportQuerySchema = Joi.object({
  entityType: Joi.string().trim().lowercase().valid(...ENTITY_TYPES).required(),
  month: Joi.string().pattern(/^\d{4}-\d{2}$/).required(),
  class_id: Joi.number().integer().positive().allow(null, ''),
  section_id: Joi.number().integer().positive().allow(null, ''),
  department_id: Joi.number().integer().positive().allow(null, ''),
  designation_id: Joi.number().integer().positive().allow(null, ''),
  academic_year_id: Joi.number().integer().positive().allow(null, ''),
});

const dayWiseQuerySchema = Joi.object({
  entityType: Joi.string().trim().lowercase().valid(...ENTITY_TYPES).required(),
  date: parseDate,
  class_id: Joi.number().integer().positive().allow(null, ''),
  section_id: Joi.number().integer().positive().allow(null, ''),
  department_id: Joi.number().integer().positive().allow(null, ''),
  academic_year_id: Joi.number().integer().positive().allow(null, ''),
});

const markingQuerySchema = Joi.object({
  entityType: Joi.string().trim().lowercase().valid(...ENTITY_TYPES).required(),
  date: parseDate,
  class_id: Joi.number().integer().positive().allow(null, ''),
  section_id: Joi.number().integer().positive().allow(null, ''),
  department_id: Joi.number().integer().positive().allow(null, ''),
  designation_id: Joi.number().integer().positive().allow(null, ''),
  academic_year_id: Joi.number().integer().positive().allow(null, ''),
});

module.exports = {
  ENTITY_TYPES,
  STATUS_TYPES,
  upsertAttendanceSchema,
  reportQuerySchema,
  dayWiseQuerySchema,
  markingQuerySchema,
};
