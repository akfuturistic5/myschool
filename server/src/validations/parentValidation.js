const Joi = require('joi');

/**
 * Optional contact email: shape validation without strict IANA TLD allowlist.
 * Joi’s default `.email()` rejects addresses whose domain TLD is not in its built-in list
 * (e.g. typos like `user@gmail.coma` fail because `coma` is not a real TLD; use `gmail.com`).
 * Set `tlds.allow` false to still require a syntactically valid email but allow any hostname/TLD.
 */
const optionalContactEmail = Joi.string()
  .trim()
  .email({ tlds: { allow: false } })
  .optional()
  .allow(null, '');

const createParentSchema = Joi.object({
  student_id: Joi.number().integer().required(),
  father_name: Joi.string().trim().optional().allow(null, ''),
  father_email: Joi.string().email().optional().allow(null, ''),
  father_phone: Joi.string().trim().optional().allow(null, ''),
  father_occupation: Joi.string().trim().optional().allow(null, ''),
  father_image_url: Joi.string().trim().optional().allow(null, ''),
  mother_name: Joi.string().trim().optional().allow(null, ''),
  mother_email: Joi.string().email().optional().allow(null, ''),
  mother_phone: Joi.string().trim().optional().allow(null, ''),
  mother_occupation: Joi.string().trim().optional().allow(null, ''),
  mother_image_url: Joi.string().trim().optional().allow(null, '')
});

const createParentWithChildSchema = Joi.object({
  name: Joi.string().trim().min(1).required(),
  phone: Joi.string().trim().min(4).required(),
  email: optionalContactEmail,
  student_id: Joi.number().integer().positive().optional().allow(null),
  profile_image_path: Joi.string().trim().max(512).optional().allow(null, ''),
});

const updateParentSchema = Joi.object({
  father_name: Joi.string().trim().optional().allow(null, ''),
  father_email: Joi.string().email().optional().allow(null, ''),
  father_phone: Joi.string().trim().optional().allow(null, ''),
  father_occupation: Joi.string().trim().optional().allow(null, ''),
  father_image_url: Joi.string().trim().optional().allow(null, ''),
  mother_name: Joi.string().trim().optional().allow(null, ''),
  mother_email: Joi.string().email().optional().allow(null, ''),
  mother_phone: Joi.string().trim().optional().allow(null, ''),
  mother_occupation: Joi.string().trim().optional().allow(null, ''),
  mother_image_url: Joi.string().trim().optional().allow(null, '')
});

module.exports = { createParentSchema, updateParentSchema, createParentWithChildSchema };
