const Joi = require('joi');

const dayStringSchema = Joi.string().trim().valid(
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
);

const createClassScheduleSchema = Joi.object({
  teacher_id: Joi.number().integer().positive().required(),
  class_id: Joi.number().integer().positive().required(),
  section_id: Joi.number().integer().positive().required(),
  academic_year_id: Joi.number().integer().positive().required(),
  subject_id: Joi.number().integer().positive().optional().allow(null),
  time_slot_id: Joi.number().integer().positive().optional().allow(null),
  day_of_week: Joi.alternatives().try(
    Joi.number().integer().min(1).max(7),
    dayStringSchema
  ).required(),
  room_number: Joi.any().optional().allow(null),
  class_room_id: Joi.number().integer().positive().optional().allow(null),
}).unknown(false);

const updateClassScheduleSchema = Joi.object({
  teacher_id: Joi.number().integer().positive().optional(),
  class_id: Joi.number().integer().positive().optional(),
  section_id: Joi.number().integer().positive().optional(),
  academic_year_id: Joi.number().integer().positive().optional(),
  subject_id: Joi.number().integer().positive().optional().allow(null),
  time_slot_id: Joi.number().integer().positive().optional().allow(null),
  day_of_week: Joi.alternatives().try(
    Joi.number().integer().min(1).max(7),
    dayStringSchema
  ).optional(),
  room_number: Joi.any().optional().allow(null),
  class_room_id: Joi.number().integer().positive().optional().allow(null),
}).min(1).unknown(false);

module.exports = { createClassScheduleSchema, updateClassScheduleSchema };
