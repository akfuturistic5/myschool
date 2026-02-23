const Joi = require('joi');

const createFeeCollectionSchema = Joi.object({
  student_id: Joi.number().integer().required(),
  fee_structure_id: Joi.number().integer().required(),
  amount_paid: Joi.number().positive().required(),
  payment_date: Joi.date().iso().optional().allow(null),
  payment_method: Joi.string().trim().optional().allow(null, ''),
  transaction_id: Joi.string().trim().max(255).optional().allow(null, ''),
  receipt_number: Joi.string().trim().max(100).optional().allow(null, ''),
  remarks: Joi.string().trim().max(500).optional().allow(null, ''),
}).unknown(true);

module.exports = { createFeeCollectionSchema };
