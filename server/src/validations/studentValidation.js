const Joi = require('joi');

const createStudentSchema = Joi.object({
  academic_year_id: Joi.number().integer().optional().allow(null),
  admission_number: Joi.string().trim().required(),
  admission_date: Joi.date().iso().optional().allow(null),
  roll_number: Joi.string().trim().optional().allow(null, ''),
  status: Joi.string().optional(),
  first_name: Joi.string().trim().required(),
  last_name: Joi.string().trim().required(),
  class_id: Joi.number().integer().optional().allow(null),
  section_id: Joi.number().integer().optional().allow(null),
  gender: Joi.string().trim().optional().allow(null, ''),
  date_of_birth: Joi.date().optional().allow(null),
  unique_student_ids: Joi.string().trim().optional().allow(null, ''),
  pen_number: Joi.string().trim().optional().allow(null, ''),
  aadhaar_no: Joi.string().trim().optional().allow(null, ''),
  blood_group_id: Joi.number().integer().optional().allow(null),
  house_id: Joi.number().integer().optional().allow(null),
  religion_id: Joi.number().integer().optional().allow(null),
  cast_id: Joi.number().integer().optional().allow(null),
  phone: Joi.string().trim().optional().allow(null, ''),
  email: Joi.string().email().optional().allow(null, ''),
  mother_tongue_id: Joi.number().integer().optional().allow(null),
  father_name: Joi.string().trim().optional().allow(null, ''),
  father_email: Joi.string().email().optional().allow(null, ''),
  father_phone: Joi.string().trim().optional().allow(null, ''),
  father_occupation: Joi.string().trim().optional().allow(null, ''),
  father_image_url: Joi.string().trim().optional().allow(null, ''),
  mother_name: Joi.string().trim().optional().allow(null, ''),
  mother_email: Joi.string().email().optional().allow(null, ''),
  mother_phone: Joi.string().trim().optional().allow(null, ''),
  mother_occupation: Joi.string().trim().optional().allow(null, ''),
  mother_image_url: Joi.string().trim().optional().allow(null, ''),
  // Guardian fields
  guardian_first_name: Joi.string().trim().optional().allow(null, ''),
  guardian_last_name: Joi.string().trim().optional().allow(null, ''),
  guardian_relation: Joi.string().trim().optional().allow(null, ''),
  guardian_phone: Joi.string().trim().optional().allow(null, ''),
  guardian_email: Joi.string().email().optional().allow(null, ''),
  guardian_occupation: Joi.string().trim().optional().allow(null, ''),
  guardian_address: Joi.string().trim().optional().allow(null, ''),
  // Address & previous school
  current_address: Joi.string().trim().optional().allow(null, ''),
  permanent_address: Joi.string().trim().optional().allow(null, ''),
  previous_school: Joi.string().trim().optional().allow(null, ''),
  previous_school_address: Joi.string().trim().optional().allow(null, ''),
  // Siblings
  sibiling_1: Joi.string().trim().optional().allow(null, ''),
  sibiling_2: Joi.string().trim().optional().allow(null, ''),
  sibiling_1_class: Joi.string().trim().optional().allow(null, ''),
  sibiling_2_class: Joi.string().trim().optional().allow(null, ''),
  // Transport
  is_transport_required: Joi.boolean().optional(),
  route_id: Joi.number().integer().optional().allow(null),
  pickup_point_id: Joi.number().integer().optional().allow(null),
  vehicle_number: Joi.string().trim().optional().allow(null, ''),
  // Hostel
  is_hostel_required: Joi.boolean().optional(),
  hostel_id: Joi.number().integer().optional().allow(null),
  hostel_room_id: Joi.number().integer().optional().allow(null),
  // Bank
  bank_name: Joi.string().trim().optional().allow(null, ''),
  branch: Joi.string().trim().optional().allow(null, ''),
  ifsc: Joi.string().trim().optional().allow(null, ''),
  // Medical & other
  known_allergies: Joi.alternatives()
    .try(
      Joi.array().items(Joi.string().trim()),
      Joi.string().trim()
    )
    .optional()
    .allow(null, ''),
  medications: Joi.alternatives()
    .try(
      Joi.array().items(Joi.string().trim()),
      Joi.string().trim()
    )
    .optional()
    .allow(null, ''),
  medical_condition: Joi.string().trim().optional().allow(null, ''),
  other_information: Joi.string().trim().optional().allow(null, '')
});

const updateStudentSchema = createStudentSchema;

const promoteStudentsSchema = Joi.object({
  student_ids: Joi.array().items(Joi.number().integer().positive()).min(1).required(),
  to_class_id: Joi.number().integer().positive().required(),
  to_section_id: Joi.number().integer().positive().required(),
  to_academic_year_id: Joi.number().integer().positive().required(),
  from_academic_year_id: Joi.number().integer().positive().optional().allow(null),
});

const leaveStudentsSchema = Joi.object({
  student_ids: Joi.array().items(Joi.number().integer().positive()).min(1).required(),
  leaving_date: Joi.date().iso().optional().allow(null),
  reason: Joi.string().trim().optional().allow(null, ''),
  remarks: Joi.string().trim().optional().allow(null, ''),
  from_academic_year_id: Joi.number().integer().positive().optional().allow(null),
});

module.exports = { createStudentSchema, updateStudentSchema, promoteStudentsSchema, leaveStudentsSchema };
