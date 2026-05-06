const Joi = require('joi');

const dateString = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);

const enquiryBodySchema = Joi.object({
  enquiry_date: dateString.required(),
  enquiry_type: Joi.string().trim().max(30).allow('', null),
  student_name: Joi.string().trim().min(2).max(200).required(),
  gender: Joi.string().trim().valid('Male', 'Female', 'Other', 'male', 'female', 'other').allow('', null),
  date_of_birth: dateString.allow('', null),
  parent_name: Joi.string().trim().max(200).allow('', null),
  mobile_number: Joi.string().trim().min(7).max(20).required(),
  previous_school: Joi.string().trim().max(200).allow('', null),
  target_class_id: Joi.number().integer().positive().allow('', null),
  source: Joi.string().trim().max(50).allow('', null),
  address: Joi.string().trim().max(500).allow('', null),
  description: Joi.string().trim().max(2000).allow('', null),
  email: Joi.string().trim().email().max(254).allow('', null),
  status: Joi.string().trim().max(50).allow('', null),
  academic_year_id: Joi.number().integer().positive().required(),
});

const enquiryQuerySchema = Joi.object({
  academic_year_id: Joi.number().integer().positive().allow('', null),
  status: Joi.string().trim().max(50).allow('', null),
  search: Joi.string().trim().max(100).allow('', null),
  enquiry_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('', null),
  from_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('', null),
  to_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('', null),
  month: Joi.string().pattern(/^\d{4}-\d{2}$/).allow('', null),
  added_by: Joi.string().trim().lowercase().valid('all', 'me', 'headmaster', 'administrative', 'teacher').allow('', null),
});

const enquiryIdParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

module.exports = {
  enquiryBodySchema,
  enquiryQuerySchema,
  enquiryIdParamSchema,
};
