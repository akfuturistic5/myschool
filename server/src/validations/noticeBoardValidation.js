const Joi = require('joi');

const createNoticeSchema = Joi.object({
  title: Joi.string().trim().max(255).required(),
  content: Joi.string().trim().max(5000).required(),
  message_to: Joi.string().trim().max(100).optional().allow(null, ''),
}).unknown(true);

const updateNoticeSchema = Joi.object({
  title: Joi.string().trim().max(255).optional(),
  content: Joi.string().trim().max(5000).optional(),
  message_to: Joi.string().trim().max(100).optional().allow(null, ''),
}).unknown(true);

module.exports = { createNoticeSchema, updateNoticeSchema };
