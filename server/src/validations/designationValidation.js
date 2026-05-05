const Joi = require('joi');

const MAX_NAME = 100;
const MAX_DESC = 5000;
const MAX_SALARY = 999999999999.99;

const salaryField = Joi.number().min(0).max(MAX_SALARY).allow(null).optional();

const designationCreateSchema = Joi.object({
  designation_name: Joi.string().trim().min(1).max(MAX_NAME).required(),
  department_id: Joi.number().integer().positive().allow(null).optional(),
  salary_range_min: salaryField,
  salary_range_max: salaryField,
  description: Joi.string().trim().max(MAX_DESC).allow('', null).optional(),
  is_active: Joi.boolean().optional().default(true),
});

const designationUpdateSchema = Joi.object({
  designation_name: Joi.string().trim().min(1).max(MAX_NAME).optional(),
  designation: Joi.string().trim().min(1).max(MAX_NAME).optional(),
  name: Joi.string().trim().min(1).max(MAX_NAME).optional(),
  department_id: Joi.number().integer().positive().allow(null).optional(),
  salary_range_min: salaryField,
  salary_range_max: salaryField,
  description: Joi.string().trim().max(MAX_DESC).allow('', null).optional(),
  is_active: Joi.boolean().optional(),
})
  .min(1)
  .messages({
    'object.min': 'At least one field is required to update',
  });

module.exports = {
  designationCreateSchema,
  designationUpdateSchema,
};
