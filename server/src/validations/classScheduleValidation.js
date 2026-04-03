const Joi = require('joi');

const createClassScheduleSchema = Joi.object({
  teacher_id: Joi.number().integer().required(),
  class_id: Joi.number().integer().required(),
  section_id: Joi.number().integer().required(),
  subject_id: Joi.number().integer().optional().allow(null),
  time_slot_id: Joi.number().integer().optional().allow(null),
  day_of_week: Joi.string().trim().max(20).optional().allow(null, ''),
  room_number: Joi.any().optional().allow(null),
  class_room_id: Joi.number().integer().optional().allow(null),
}).unknown(true);

module.exports = { createClassScheduleSchema };
