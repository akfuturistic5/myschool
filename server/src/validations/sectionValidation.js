const Joi = require('joi');

const optionalPositiveInt = Joi.number().integer().positive().allow(null);
const optionalNonNegativeInt = Joi.number().integer().min(0).allow(null);

const sectionCreateSchema = Joi.object({
  section_name: Joi.string().trim().min(1).max(10).required(),
  description: Joi.string().trim().max(5000).allow('', null).optional(),
  class_id: optionalPositiveInt.optional(),
  academic_year_id: optionalPositiveInt.optional(),
  max_students: optionalNonNegativeInt.optional(),
  class_room_id: optionalPositiveInt.optional(),
  is_active: Joi.boolean().optional(),
}).unknown(false);

const sectionUpdateSchema = Joi.object({
  section_name: Joi.string().trim().min(1).max(10).optional(),
  description: Joi.string().trim().max(5000).allow('', null).optional(),
  class_id: optionalPositiveInt.optional(),
  academic_year_id: optionalPositiveInt.optional(),
  max_students: optionalNonNegativeInt.optional(),
  class_room_id: optionalPositiveInt.optional(),
  is_active: Joi.boolean().optional(),
})
  .min(1)
  .unknown(false);

module.exports = {
  sectionCreateSchema,
  sectionUpdateSchema,
};
