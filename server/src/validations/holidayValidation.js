const Joi = require('joi');

const parseDate = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .required();

const holidayBodySchema = Joi.object({
  title: Joi.string().trim().min(2).max(200).required(),
  description: Joi.string().trim().max(2000).allow('', null),
  start_date: parseDate,
  end_date: parseDate,
  holiday_type: Joi.string().trim().lowercase().valid('public', 'school', 'custom').allow('', null),
  academic_year_id: Joi.number().integer().positive().allow(null),
});

const holidayQuerySchema = Joi.object({
  start_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('', null),
  end_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('', null),
  month: Joi.number().integer().min(1).max(12).allow('', null),
  year: Joi.number().integer().min(2000).max(2100).allow('', null),
  academic_year_id: Joi.number().integer().positive().allow('', null),
});

const holidayIdParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

module.exports = {
  holidayBodySchema,
  holidayQuerySchema,
  holidayIdParamSchema,
};
