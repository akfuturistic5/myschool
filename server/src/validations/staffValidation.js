const Joi = require('joi');

const staffCreateSchema = Joi.object({
  employee_code: Joi.string().trim().max(20).optional().allow(null, ''),
  first_name: Joi.string().trim().min(1).max(50).required(),
  last_name: Joi.string().trim().min(1).max(50).required(),
  email: Joi.string().trim().email().max(100).required(),
  phone: Joi.string().trim().min(7).max(22).required(),
  password: Joi.string().trim().min(6).max(200).optional().allow(null, ''),
  gender: Joi.string().trim().valid('male', 'female', 'other', '').optional().allow(null),
  date_of_birth: Joi.alternatives().try(Joi.date().iso(), Joi.string().trim().allow(null, '')).optional(),
  blood_group_id: Joi.number().integer().positive().optional().allow(null),
  designation_id: Joi.number().integer().positive().optional().allow(null),
  department_id: Joi.number().integer().positive().optional().allow(null),
  joining_date: Joi.alternatives().try(Joi.date().iso(), Joi.string().trim().allow(null, '')).optional(),
  salary: Joi.number().min(0).max(99999999.99).optional().allow(null),
  qualification: Joi.string().trim().max(5000).optional().allow(null, ''),
  experience_years: Joi.number().integer().min(0).max(80).optional().allow(null),
  address: Joi.string().trim().max(10000).optional().allow(null, ''),
  emergency_contact_name: Joi.string().trim().max(100).optional().allow(null, ''),
  emergency_contact_phone: Joi.string().trim().max(15).optional().allow(null, ''),
  photo_url: Joi.string().trim().max(500).optional().allow(null, ''),
  is_active: Joi.boolean().optional(),
  license_number: Joi.string().trim().max(50).optional().allow(null, ''),
  license_expiry: Joi.alternatives()
    .try(Joi.date().iso(), Joi.string().trim().allow(null, ''))
    .optional(),
}).unknown(false);

const staffUpdateSchema = Joi.object({
  employee_code: Joi.string().trim().max(20).optional().allow(null, ''),
  first_name: Joi.string().trim().min(1).max(50).optional(),
  last_name: Joi.string().trim().min(1).max(50).optional(),
  email: Joi.string().trim().email().max(100).optional(),
  phone: Joi.string().trim().min(7).max(22).optional().allow(null, ''),
  password: Joi.string().trim().min(6).max(200).optional().allow(null, ''),
  gender: Joi.string().trim().valid('male', 'female', 'other', '').optional().allow(null),
  date_of_birth: Joi.alternatives().try(Joi.date().iso(), Joi.string().trim().allow(null, '')).optional(),
  blood_group_id: Joi.number().integer().positive().optional().allow(null),
  designation_id: Joi.number().integer().positive().optional().allow(null),
  department_id: Joi.number().integer().positive().optional().allow(null),
  joining_date: Joi.alternatives().try(Joi.date().iso(), Joi.string().trim().allow(null, '')).optional(),
  salary: Joi.number().min(0).max(99999999.99).optional().allow(null),
  qualification: Joi.string().trim().max(5000).optional().allow(null, ''),
  experience_years: Joi.number().integer().min(0).max(80).optional().allow(null),
  address: Joi.string().trim().max(10000).optional().allow(null, ''),
  emergency_contact_name: Joi.string().trim().max(100).optional().allow(null, ''),
  emergency_contact_phone: Joi.string().trim().max(15).optional().allow(null, ''),
  photo_url: Joi.string().trim().max(500).optional().allow(null, ''),
  is_active: Joi.boolean().optional(),
  license_number: Joi.string().trim().max(50).optional().allow(null, ''),
  license_expiry: Joi.alternatives()
    .try(Joi.date().iso(), Joi.string().trim().allow(null, ''))
    .optional(),
}).min(1).unknown(false);

module.exports = {
  staffCreateSchema,
  staffUpdateSchema,
};
