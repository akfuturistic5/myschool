const Joi = require('joi');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const copyOptionsSchema = Joi.object({
  classes: Joi.boolean().optional(),
  sections: Joi.boolean().optional(),
  subjects: Joi.boolean().optional(),
  teacherAssignments: Joi.boolean().optional(),
  timetable: Joi.boolean().optional(),
  departments: Joi.boolean().optional(),
  designations: Joi.boolean().optional(),
  transport: Joi.boolean().optional(),
}).unknown(false);

const createAcademicYearSchema = Joi.object({
  name: Joi.string().trim().min(1).max(20).optional(),
  year_name: Joi.string().trim().min(1).max(20).optional(),
  start_date: Joi.string().pattern(DATE_RE).required(),
  end_date: Joi.string().pattern(DATE_RE).optional().allow(null, ''),
  is_current: Joi.boolean().optional(),
  is_active: Joi.boolean().optional(),
  copy_from_year_id: Joi.number().integer().positive().optional().allow(null),
  copy_options: copyOptionsSchema.optional(),
})
  .or('name', 'year_name')
  .unknown(false);

const updateAcademicYearSchema = Joi.object({
  year_name: Joi.string().trim().min(1).max(20).optional(),
  start_date: Joi.string().pattern(DATE_RE).optional().allow(null, ''),
  end_date: Joi.string().pattern(DATE_RE).optional().allow(null, ''),
  is_current: Joi.boolean().optional(),
  is_active: Joi.boolean().optional(),
})
  .min(1)
  .unknown(false);

const deleteAcademicYearSchema = Joi.object({
  password: Joi.string().min(1).max(200).required(),
}).unknown(false);

module.exports = {
  createAcademicYearSchema,
  updateAcademicYearSchema,
  deleteAcademicYearSchema,
};
