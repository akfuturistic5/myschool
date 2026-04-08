const Joi = require('joi');

const ymdString = Joi.string()
  .trim()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .message('must be a valid date in YYYY-MM-DD format');

const ymdStringOptional = Joi.string()
  .trim()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .message('must be a valid date in YYYY-MM-DD format');

const money = Joi.number().positive().max(999999999999.99).required();
const moneyOptional = Joi.number().positive().max(999999999999.99);

const createIncomeSchema = Joi.object({
  income_name: Joi.string().trim().min(1).max(255).required(),
  description: Joi.string().trim().max(5000).allow(null, ''),
  source: Joi.string().trim().max(255).allow(null, ''),
  income_date: ymdString.required(),
  amount: money,
  invoice_no: Joi.string().trim().max(64).allow(null, ''),
  payment_method: Joi.string().trim().max(64).allow(null, ''),
  academic_year_id: Joi.number().integer().positive().allow(null),
});

const updateIncomeSchema = Joi.object({
  income_name: Joi.string().trim().min(1).max(255).optional(),
  description: Joi.string().trim().max(5000).allow(null, ''),
  source: Joi.string().trim().max(255).allow(null, ''),
  income_date: ymdStringOptional.optional(),
  amount: moneyOptional.optional(),
  invoice_no: Joi.string().trim().max(64).allow(null, ''),
  payment_method: Joi.string().trim().max(64).allow(null, ''),
  academic_year_id: Joi.number().integer().positive().allow(null),
}).min(1);

const createInvoiceSchema = Joi.object({
  invoice_number: Joi.string().trim().min(1).max(64).required(),
  invoice_date: ymdString.required(),
  description: Joi.string().trim().max(5000).allow(null, ''),
  amount: money,
  payment_method: Joi.string().trim().max(64).allow(null, ''),
  due_date: ymdString.required(),
  status: Joi.string().valid('Paid', 'Pending', 'Overdue').required(),
  academic_year_id: Joi.number().integer().positive().allow(null),
});

const updateInvoiceSchema = Joi.object({
  invoice_number: Joi.string().trim().min(1).max(64).optional(),
  invoice_date: ymdStringOptional.optional(),
  description: Joi.string().trim().max(5000).allow(null, ''),
  amount: moneyOptional.optional(),
  payment_method: Joi.string().trim().max(64).allow(null, ''),
  due_date: ymdStringOptional.optional(),
  status: Joi.string().valid('Paid', 'Pending', 'Overdue').optional(),
  academic_year_id: Joi.number().integer().positive().allow(null),
}).min(1);

const createExpenseCategorySchema = Joi.object({
  category_name: Joi.string().trim().min(1).max(255).required(),
  description: Joi.string().trim().max(5000).allow(null, ''),
  academic_year_id: Joi.number().integer().positive().allow(null),
  is_active: Joi.boolean().optional(),
});

const updateExpenseCategorySchema = Joi.object({
  category_name: Joi.string().trim().min(1).max(255).optional(),
  description: Joi.string().trim().max(5000).allow(null, ''),
  academic_year_id: Joi.number().integer().positive().allow(null),
  is_active: Joi.boolean().optional(),
}).min(1);

const createExpenseSchema = Joi.object({
  expense_name: Joi.string().trim().min(1).max(255).required(),
  category_id: Joi.number().integer().positive().required(),
  expense_date: ymdString.required(),
  amount: money,
  description: Joi.string().trim().max(5000).allow(null, ''),
  invoice_no: Joi.string().trim().max(64).allow(null, ''),
  payment_method: Joi.string().trim().max(64).allow(null, ''),
  status: Joi.string().valid('Completed', 'Pending').optional(),
  academic_year_id: Joi.number().integer().positive().allow(null),
});

const updateExpenseSchema = Joi.object({
  expense_name: Joi.string().trim().min(1).max(255).optional(),
  category_id: Joi.number().integer().positive().optional(),
  expense_date: ymdStringOptional.optional(),
  amount: moneyOptional.optional(),
  description: Joi.string().trim().max(5000).allow(null, ''),
  invoice_no: Joi.string().trim().max(64).allow(null, ''),
  payment_method: Joi.string().trim().max(64).allow(null, ''),
  status: Joi.string().valid('Completed', 'Pending').optional(),
  academic_year_id: Joi.number().integer().positive().allow(null),
}).min(1);

module.exports = {
  createIncomeSchema,
  updateIncomeSchema,
  createInvoiceSchema,
  updateInvoiceSchema,
  createExpenseCategorySchema,
  updateExpenseCategorySchema,
  createExpenseSchema,
  updateExpenseSchema,
};
