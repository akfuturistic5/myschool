const Joi = require('joi');

const createGuardianSchema = Joi.object({
  student_id: Joi.number().integer().required(),
  guardian_type: Joi.string().trim().optional().allow(null, ''),
  first_name: Joi.string().trim().required(),
  last_name: Joi.string().trim().required(),
  relation: Joi.string().trim().optional().allow(null, ''),
  occupation: Joi.string().trim().optional().allow(null, ''),
  phone: Joi.string().trim().required(),
  email: Joi.string().email().optional().allow(null, ''),
  address: Joi.string().trim().optional().allow(null, ''),
  office_address: Joi.string().trim().optional().allow(null, ''),
  is_primary_contact: Joi.boolean().optional(),
  is_emergency_contact: Joi.boolean().optional(),
}).unknown(true);

const updateGuardianSchema = Joi.object({
  student_id: Joi.number().integer().optional(),
  guardian_type: Joi.string().trim().optional().allow(null, ''),
  first_name: Joi.string().trim().required(),
  last_name: Joi.string().trim().required(),
  relation: Joi.string().trim().optional().allow(null, ''),
  occupation: Joi.string().trim().optional().allow(null, ''),
  phone: Joi.string().trim().required(),
  email: Joi.string().email().optional().allow(null, ''),
  address: Joi.string().trim().optional().allow(null, ''),
  office_address: Joi.string().trim().optional().allow(null, ''),
  is_primary_contact: Joi.boolean().optional(),
  is_emergency_contact: Joi.boolean().optional(),
}).unknown(true);

module.exports = { createGuardianSchema, updateGuardianSchema };
