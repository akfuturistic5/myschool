const Joi = require('joi');

const scheduleCreateSchema = Joi.object({
  slot_name: Joi.string().trim().min(1).max(100).required(),
  start_time: Joi.string().trim().pattern(/^\d{2}:\d{2}(:\d{2})?$/).required(),
  end_time: Joi.string().trim().pattern(/^\d{2}:\d{2}(:\d{2})?$/).required(),
  duration: Joi.number().integer().min(1).max(720).optional(),
  is_break: Joi.boolean().optional(),
  is_active: Joi.boolean().optional(),
  description: Joi.string().max(5000).optional().allow(null, ''),
}).unknown(false);

const scheduleUpdateSchema = Joi.object({
  slot_name: Joi.string().trim().min(1).max(100).optional(),
  start_time: Joi.string().trim().pattern(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  end_time: Joi.string().trim().pattern(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  duration: Joi.number().integer().min(1).max(720).optional(),
  is_break: Joi.boolean().optional(),
  is_active: Joi.boolean().optional(),
  description: Joi.string().max(5000).optional().allow(null, ''),
}).min(1).unknown(false);

module.exports = {
  scheduleCreateSchema,
  scheduleUpdateSchema,
};
