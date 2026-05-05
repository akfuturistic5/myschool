const Joi = require('joi');

const subjectCreateSchema = Joi.object({
  subject_name: Joi.string().trim().min(1).max(100).required(),
  subject_code: Joi.string().trim().max(20).optional().allow(null, ''),
  subject_type: Joi.string().valid('Theory', 'Practical').required(),
  description: Joi.string().max(5000).optional().allow(null, ''),
  is_active: Joi.boolean().optional(),
}).unknown(false);

const subjectUpdateSchema = Joi.object({
  subject_name: Joi.string().trim().min(1).max(100).optional(),
  subject_code: Joi.string().trim().max(20).optional().allow(null, ''),
  subject_type: Joi.string().valid('Theory', 'Practical').optional(),
  description: Joi.string().max(5000).optional().allow(null, ''),
  is_active: Joi.boolean().optional(),
}).min(1).unknown(false);

module.exports = {
  subjectCreateSchema,
  subjectUpdateSchema,
};
