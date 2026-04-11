const Joi = require('joi');

const createLeaveApplicationSchema = Joi.object({
  leave_type_id: Joi.number().integer().required(),
  student_id: Joi.number().integer().optional().allow(null),
  staff_id: Joi.number().integer().optional().allow(null),
  start_date: Joi.date().iso().required(),
  end_date: Joi.date().iso().min(Joi.ref('start_date')).required(),
  reason: Joi.string().trim().min(1).max(1000).required(),
  emergency_contact: Joi.string().trim().max(20).optional().allow(null, ''),
}).unknown(true);

const updateLeaveStatusSchema = Joi.object({
  status: Joi.string().trim().lowercase().valid('approved', 'rejected').required(),
  rejection_reason: Joi.when('status', {
    is: 'rejected',
    then: Joi.string().trim().min(1).max(1000).required(),
    otherwise: Joi.string().trim().max(1000).optional().allow(null, ''),
  }),
}).unknown(true);

const cancelLeaveSchema = Joi.object({}).unknown(true);

module.exports = { createLeaveApplicationSchema, updateLeaveStatusSchema, cancelLeaveSchema };
