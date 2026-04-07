const Joi = require('joi');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const createAcademicYearSchema = Joi.object({
  year_name: Joi.string().trim().min(1).max(20).required(),
  start_date: Joi.string().pattern(DATE_RE).required(),
  end_date: Joi.string().pattern(DATE_RE).optional().allow(null, ''),
  is_current: Joi.boolean().optional(),
  is_active: Joi.boolean().optional(),
}).unknown(false);

const updateAcademicYearSchema = Joi.object({
  year_name: Joi.string().trim().min(1).max(20).optional(),
  start_date: Joi.string().pattern(DATE_RE).optional().allow(null, ''),
  end_date: Joi.string().pattern(DATE_RE).optional().allow(null, ''),
  is_current: Joi.boolean().optional(),
  is_active: Joi.boolean().optional(),
})
  .min(1)
  .unknown(false);

module.exports = {
  createAcademicYearSchema,
  updateAcademicYearSchema,
};
