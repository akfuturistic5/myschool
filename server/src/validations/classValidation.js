const Joi = require('joi');

const classCreateSchema = Joi.object({
  class_name: Joi.string().trim().min(1).max(50).required(),
  class_code: Joi.string().trim().max(10).optional().allow(null, ''),
  academic_year_id: Joi.number().integer().positive().required(),
  class_teacher_id: Joi.number().integer().positive().optional().allow(null),
  max_students: Joi.number().integer().min(1).max(10000).optional(),
  class_fee: Joi.number().min(0).optional().allow(null),
  description: Joi.string().max(5000).optional().allow(null, ''),
  is_active: Joi.boolean().optional(),
  no_of_students: Joi.number().integer().min(0).max(100000).optional(),
}).unknown(false);

const classUpdateSchema = Joi.object({
  class_name: Joi.string().trim().min(1).max(50).optional(),
  class_code: Joi.string().trim().max(10).optional().allow(null, ''),
  academic_year_id: Joi.number().integer().positive().optional(),
  class_teacher_id: Joi.number().integer().positive().optional().allow(null),
  max_students: Joi.number().integer().min(1).max(10000).optional(),
  class_fee: Joi.number().min(0).optional().allow(null),
  description: Joi.string().max(5000).optional().allow(null, ''),
  is_active: Joi.boolean().optional(),
  no_of_students: Joi.number().integer().min(0).max(100000).optional(),
}).min(1).unknown(false);

module.exports = {
  classCreateSchema,
  classUpdateSchema,
};
