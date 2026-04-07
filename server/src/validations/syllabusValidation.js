const Joi = require('joi');

const syllabusCreateSchema = Joi.object({
  class_id: Joi.number().integer().positive().required(),
  section_id: Joi.number().integer().positive().optional().allow(null),
  academic_year_id: Joi.number().integer().positive().required(),
  subject_group: Joi.string().trim().max(100).optional().allow(null, ''),
  subject_name: Joi.string().trim().max(255).optional().allow(null, ''),
  no_of_periods: Joi.number().integer().min(0).max(2000).optional(),
}).or('subject_group', 'subject_name').unknown(false);

const syllabusUpdateSchema = Joi.object({
  class_id: Joi.number().integer().positive().optional(),
  section_id: Joi.number().integer().positive().optional().allow(null),
  academic_year_id: Joi.number().integer().positive().optional(),
  subject_group: Joi.string().trim().max(100).optional().allow(null, ''),
  subject_name: Joi.string().trim().max(255).optional().allow(null, ''),
  no_of_periods: Joi.number().integer().min(0).max(2000).optional(),
}).min(1).unknown(false);

module.exports = {
  syllabusCreateSchema,
  syllabusUpdateSchema,
};
