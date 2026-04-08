const Joi = require('joi');

const subjectCreateSchema = Joi.object({
  subject_name: Joi.string().trim().min(1).max(100).required(),
  subject_code: Joi.string().trim().max(20).optional().allow(null, ''),
  class_id: Joi.number().integer().positive().optional().allow(null),
  teacher_id: Joi.number().integer().positive().optional().allow(null),
  theory_hours: Joi.number().integer().min(0).max(200).optional(),
  practical_hours: Joi.number().integer().min(0).max(200).optional(),
  total_marks: Joi.number().integer().min(0).max(1000).optional(),
  passing_marks: Joi.number().integer().min(0).max(1000).optional(),
  description: Joi.string().max(5000).optional().allow(null, ''),
  is_active: Joi.boolean().optional(),
}).unknown(false);

const subjectUpdateSchema = Joi.object({
  subject_name: Joi.string().trim().min(1).max(100).optional(),
  subject_code: Joi.string().trim().max(20).optional().allow(null, ''),
  class_id: Joi.number().integer().positive().optional().allow(null),
  teacher_id: Joi.number().integer().positive().optional().allow(null),
  theory_hours: Joi.number().integer().min(0).max(200).optional(),
  practical_hours: Joi.number().integer().min(0).max(200).optional(),
  total_marks: Joi.number().integer().min(0).max(1000).optional(),
  passing_marks: Joi.number().integer().min(0).max(1000).optional(),
  description: Joi.string().max(5000).optional().allow(null, ''),
  is_active: Joi.boolean().optional(),
}).min(1).unknown(false);

module.exports = {
  subjectCreateSchema,
  subjectUpdateSchema,
};
