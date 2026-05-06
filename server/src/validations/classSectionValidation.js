const Joi = require('joi');

const assignSectionsSchema = Joi.object({
  class_id: Joi.number().integer().positive().required(),
  academic_year_id: Joi.number().integer().positive().optional().allow(null),
  section_ids: Joi.array().items(
    Joi.alternatives().try(
      Joi.number().integer().positive(),
      Joi.object({
        section_id: Joi.number().integer().positive().required(),
        class_room_id: Joi.number().integer().positive().optional().allow(null),
        room_number: Joi.string().allow(null, ''),
        max_students: Joi.number().integer().min(1).default(30)
      })
    )
  ).required(),
}).unknown(false);

module.exports = {
  assignSectionsSchema,
};
