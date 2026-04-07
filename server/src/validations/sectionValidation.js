const Joi = require('joi');

const sectionCreateSchema = Joi.object({
  section_name: Joi.string().trim().min(1).max(20).required(),
  class_id: Joi.number().integer().positive().required(),
  section_teacher_id: Joi.number().integer().positive().optional().allow(null),
  max_students: Joi.number().integer().min(1).max(10000).optional(),
  room_number: Joi.string().trim().max(20).optional().allow(null, ''),
  description: Joi.string().max(5000).optional().allow(null, ''),
  is_active: Joi.boolean().optional(),
  no_of_students: Joi.number().integer().min(0).max(100000).optional(),
}).unknown(false);

const sectionUpdateSchema = Joi.object({
  section_name: Joi.string().trim().min(1).max(20).optional(),
  section_teacher_id: Joi.number().integer().positive().optional().allow(null),
  max_students: Joi.number().integer().min(1).max(10000).optional(),
  room_number: Joi.string().trim().max(20).optional().allow(null, ''),
  description: Joi.string().max(5000).optional().allow(null, ''),
  is_active: Joi.boolean().optional(),
  no_of_students: Joi.number().integer().min(0).max(100000).optional(),
}).min(1).unknown(false);

module.exports = {
  sectionCreateSchema,
  sectionUpdateSchema,
};
