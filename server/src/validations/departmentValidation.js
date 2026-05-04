const Joi = require('joi');

const MAX_NAME = 100;
const MAX_CODE = 10;

const optionalCode = Joi.alternatives()
  .try(Joi.string().trim().max(MAX_CODE), Joi.valid(null))
  .optional();

const departmentCreateSchema = Joi.object({
  department_name: Joi.string().trim().max(MAX_NAME).required(),
  department_code: optionalCode,
  head_of_department: Joi.number().integer().positive().allow(null).optional(),
  is_active: Joi.boolean().optional().default(true),
});

const departmentUpdateSchema = Joi.object({
  department_name: Joi.string().trim().min(1).max(MAX_NAME).optional(),
  department_code: optionalCode,
  head_of_department: Joi.number().integer().positive().allow(null).optional(),
  is_active: Joi.boolean().optional(),
})
  .min(1)
  .messages({
    'object.min': 'At least one field is required to update',
  });

module.exports = {
  departmentCreateSchema,
  departmentUpdateSchema,
};
