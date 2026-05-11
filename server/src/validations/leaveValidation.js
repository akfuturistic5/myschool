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

const leaveTypePayloadSchema = Joi.object({
  leave_type: Joi.string().trim().min(2).max(100).required(),
  code: Joi.string().trim().max(20).allow(null, ''),
  max_days: Joi.number().integer().min(0).allow(null),
  description: Joi.string().trim().max(1000).allow(null, ''),
  is_paid: Joi.boolean().optional(),
  applicable_for: Joi.string().trim().lowercase().valid('student', 'staff', 'both').allow(null, ''),
  requires_medical_certificate: Joi.boolean().optional(),
  is_active: Joi.boolean().optional(),
}).unknown(false);

const createLeaveTypeSchema = leaveTypePayloadSchema;
const updateLeaveTypeSchema = leaveTypePayloadSchema.fork(['leave_type'], (schema) => schema.optional());

module.exports = {
  createLeaveApplicationSchema,
  updateLeaveStatusSchema,
  cancelLeaveSchema,
  createLeaveTypeSchema,
  updateLeaveTypeSchema,
};
