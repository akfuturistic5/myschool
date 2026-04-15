const Joi = require('joi');

const createAddressSchema = Joi.object({
  current_address: Joi.string().trim().required(),
  permanent_address: Joi.string().trim().required(),
  user_id: Joi.number().integer().required(),
  role_id: Joi.number().integer().required(),
  person_id: Joi.number().integer().optional().allow(null)
});

const updateAddressSchema = Joi.object({
  current_address: Joi.string().trim().required(),
  permanent_address: Joi.string().trim().required(),
  user_id: Joi.number().integer().required(),
  role_id: Joi.number().integer().required(),
  person_id: Joi.number().integer().optional().allow(null)
});

module.exports = { createAddressSchema, updateAddressSchema };
