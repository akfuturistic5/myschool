const Joi = require('joi');

const createLeaveApplicationSchema = Joi.object({
  leave_type_id: Joi.number().integer().required(),
  student_id: Joi.number().integer().optional().allow(null),
  staff_id: Joi.number().integer().optional().allow(null),
  start_date: Joi.date().iso().required(),
  end_date: Joi.date().iso().required(),
  reason: Joi.string().trim().max(1000).optional().allow(null, ''),
}).unknown(true);

const updateLeaveStatusSchema = Joi.object({
  status: Joi.string().valid('approved', 'rejected', 'reject', 'pending').required(),
}).unknown(true);

module.exports = { createLeaveApplicationSchema, updateLeaveStatusSchema };
