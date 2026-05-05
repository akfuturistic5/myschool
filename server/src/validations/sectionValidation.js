const Joi = require('joi');

const sectionCreateSchema = Joi.object({
  // DB: sections.section_name VARCHAR(10) NOT NULL
  section_name: Joi.string().trim().min(1).max(10).required(),
  is_active: Joi.boolean().optional(),
}).unknown(false);

const sectionUpdateSchema = Joi.object({
  section_name: Joi.string().trim().min(1).max(10).optional(),
  is_active: Joi.boolean().optional(),
}).min(1).unknown(false);

module.exports = {
  sectionCreateSchema,
  sectionUpdateSchema,
};
