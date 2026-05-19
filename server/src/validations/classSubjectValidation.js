const Joi = require('joi');

const electiveGroupCreateSchema = Joi.object({
  group_name: Joi.string().trim().max(100).required(),
  description: Joi.string().trim().allow('', null).optional(),
  class_id: Joi.number().integer().required(),
  max_subjects: Joi.number().integer().min(0).optional(),
  selectable_subjects: Joi.number().integer().min(0).optional(),
}).unknown(false);

const electiveGroupUpdateSchema = Joi.object({
  group_name: Joi.string().trim().max(100).required(),
  description: Joi.string().trim().allow('', null).optional(),
  max_subjects: Joi.number().integer().min(0).optional(),
  selectable_subjects: Joi.number().integer().min(0).optional(),
}).unknown(false);

const classSubjectAssignSchema = Joi.object({
  class_id: Joi.number().integer().required(),
  subject_id: Joi.number().integer().required(),
  academic_year_id: Joi.number().integer().required(),
  is_elective: Joi.boolean().optional().default(false),
  elective_group_id: Joi.number().integer().allow(null).optional(),
}).unknown(false);

const classSubjectUpdateSchema = Joi.object({
  is_elective: Joi.boolean().optional(),
  elective_group_id: Joi.number().integer().allow(null).optional(),
}).min(1).unknown(false);

module.exports = {
  electiveGroupCreateSchema,
  electiveGroupUpdateSchema,
  classSubjectAssignSchema,
  classSubjectUpdateSchema,
};
