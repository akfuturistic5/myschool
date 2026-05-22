const Joi = require('joi');

const HOMEWORK_TYPES = [
  'Homework',
  'Assignment',
  'Project',
  'Worksheet',
  'Practical',
  'Reading',
  'Activity',
];

const HOMEWORK_STATUSES = ['Draft', 'Published', 'Closed', 'Archived'];

const attachmentSchema = Joi.object({
  file_name: Joi.string().trim().max(255).required(),
  file_path: Joi.string().trim().required(),
  file_type: Joi.string().trim().max(100).allow(null, ''),
  file_size: Joi.number().integer().min(0).allow(null),
});

const createHomeworkSchema = Joi.object({
  academic_year_id: Joi.number().integer().required(),
  class_id: Joi.number().integer().required(),
  class_section_id: Joi.number().integer().required(),
  class_subject_id: Joi.number().integer().required(),
  teacher_assignment_id: Joi.number().integer().required(),
  title: Joi.string().trim().max(200).required(),
  description: Joi.string().trim().allow(null, ''),
  instructions: Joi.string().trim().allow(null, ''),
  homework_type: Joi.string()
    .trim()
    .valid(...HOMEWORK_TYPES)
    .default('Homework'),
  assign_date: Joi.date().iso().required(),
  due_date: Joi.date().iso().min(Joi.ref('assign_date')).required(),
  publish_at: Joi.date().iso().allow(null),
  visible_until: Joi.date().iso().allow(null),
  resubmission_allowed: Joi.boolean().default(true),
  allow_late_submission: Joi.boolean().default(true),
  max_attempts: Joi.number().integer().min(1).max(20).default(1),
  is_graded: Joi.boolean().default(true),
  max_marks: Joi.number().min(0).max(999.99).allow(null),
  status: Joi.string()
    .trim()
    .valid(...HOMEWORK_STATUSES)
    .default('Draft'),
  assignment_mode: Joi.string().trim().valid('section', 'students').default('section'),
  student_ids: Joi.when('assignment_mode', {
    is: 'students',
    then: Joi.array().items(Joi.number().integer().positive()).min(1).required(),
    otherwise: Joi.array().items(Joi.number().integer().positive()).max(0).default([]),
  }),
  attachments: Joi.array().items(attachmentSchema).max(20).default([]),
});

const listHomeworkQuerySchema = Joi.object({
  academic_year_id: Joi.number().integer().optional(),
  class_id: Joi.number().integer().optional(),
  class_section_id: Joi.number().integer().optional(),
  class_subject_id: Joi.number().integer().optional(),
  status: Joi.string()
    .trim()
    .valid(...HOMEWORK_STATUSES)
    .optional(),
  from_date: Joi.date().iso().optional(),
  to_date: Joi.date().iso().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(25),
});

const updateHomeworkSchema = Joi.object({
  title: Joi.string().trim().max(200).optional(),
  description: Joi.string().trim().allow(null, ''),
  instructions: Joi.string().trim().allow(null, ''),
  homework_type: Joi.string().trim().valid(...HOMEWORK_TYPES).optional(),
  assign_date: Joi.date().iso().optional(),
  due_date: Joi.date().iso().optional(),
  publish_at: Joi.date().iso().allow(null),
  visible_until: Joi.date().iso().allow(null),
  resubmission_allowed: Joi.boolean().optional(),
  allow_late_submission: Joi.boolean().optional(),
  max_attempts: Joi.number().integer().min(1).max(20).optional(),
  is_graded: Joi.boolean().optional(),
  max_marks: Joi.number().min(0).max(999.99).allow(null),
  status: Joi.string().trim().valid(...HOMEWORK_STATUSES).optional(),
}).min(1);

const patchHomeworkStatusSchema = Joi.object({
  status: Joi.string().trim().valid(...HOMEWORK_STATUSES).required(),
});

const addHomeworkAttachmentSchema = Joi.object({
  file_name: Joi.string().trim().max(255).required(),
  file_path: Joi.string().trim().required(),
  file_type: Joi.string().trim().max(100).allow(null, ''),
  file_size: Joi.number().integer().min(0).allow(null),
});

const evaluateSubmissionSchema = Joi.object({
  marks_obtained: Joi.number().min(0).max(999.99).allow(null),
  teacher_feedback: Joi.string().trim().allow(null, ''),
  status: Joi.string().trim().valid('Evaluated', 'Under Review').default('Evaluated'),
});

const returnSubmissionSchema = Joi.object({
  teacher_feedback: Joi.string().trim().allow(null, ''),
  status: Joi.string()
    .trim()
    .valid('Returned', 'Resubmission Requested')
    .default('Resubmission Requested'),
});

const createStudentSubmissionSchema = Joi.object({
  submission_text: Joi.string().trim().allow(null, ''),
  status: Joi.string().trim().valid('Draft', 'Submitted').default('Submitted'),
  attachments: Joi.array().items(attachmentSchema).max(10).default([]),
});

module.exports = {
  createHomeworkSchema,
  updateHomeworkSchema,
  listHomeworkQuerySchema,
  patchHomeworkStatusSchema,
  addHomeworkAttachmentSchema,
  evaluateSubmissionSchema,
  returnSubmissionSchema,
  createStudentSubmissionSchema,
  HOMEWORK_TYPES,
  HOMEWORK_STATUSES,
};
