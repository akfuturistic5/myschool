const Joi = require('joi');

const dateString = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);

const enquiryBodySchema = Joi.object({
  enquiry_date: dateString.required(),
  name: Joi.string().trim().min(2).max(160).required(),
  mobile_number: Joi.string().trim().min(7).max(20).required(),
  address: Joi.string().trim().max(500).allow('', null),
  enquiry_about: Joi.string().trim().min(2).max(200).required(),
  description: Joi.string().trim().max(2000).allow('', null),
  email: Joi.string().trim().email().max(254).allow('', null),
  status: Joi.string().trim().lowercase().valid('open', 'in_progress', 'closed').allow('', null),
  academic_year_id: Joi.number().integer().positive().required(),
});

const enquiryQuerySchema = Joi.object({
  academic_year_id: Joi.number().integer().positive().allow('', null),
  status: Joi.string().trim().lowercase().valid('open', 'in_progress', 'closed').allow('', null),
  search: Joi.string().trim().max(100).allow('', null),
  enquiry_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('', null),
  from_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('', null),
  to_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('', null),
  month: Joi.string().pattern(/^\d{4}-\d{2}$/).allow('', null),
  added_by: Joi.string().trim().lowercase().valid('all', 'me', 'headmaster', 'administrative', 'teacher').allow('', null),
});

module.exports = {
  enquiryBodySchema,
  enquiryQuerySchema,
};
