const Joi = require('joi');

const createCategorySchema = Joi.object({
  category_name: Joi.string().trim().max(100).required(),
  description: Joi.string().trim().max(2000).allow(null, ''),
  is_active: Joi.boolean().optional(),
});

const updateCategorySchema = Joi.object({
  category_name: Joi.string().trim().max(100).optional(),
  description: Joi.string().trim().max(2000).allow(null, ''),
  is_active: Joi.boolean().optional(),
}).min(1);

const createBookSchema = Joi.object({
  book_title: Joi.string().trim().max(200).required(),
  book_code: Joi.string().trim().max(50).allow(null, ''),
  author: Joi.string().trim().max(200).allow(null, ''),
  edition: Joi.string().trim().max(50).allow(null, ''),
  language: Joi.string().trim().max(50).allow(null, ''),
  isbn: Joi.string().trim().max(20).allow(null, ''),
  publisher: Joi.string().trim().max(100).allow(null, ''),
  publication_year: Joi.number().integer().min(1000).max(2100).allow(null),
  category_id: Joi.number().integer().allow(null),
  total_copies: Joi.number().integer().min(1).optional(),
  available_copies: Joi.number().integer().min(0).optional(),
  book_location: Joi.string().trim().max(50).allow(null, ''),
  description: Joi.string().allow(null, ''),
  academic_year_id: Joi.number().integer().allow(null),
});

const updateBookSchema = Joi.object({
  book_title: Joi.string().trim().max(200).optional(),
  book_code: Joi.string().trim().max(50).allow(null, ''),
  author: Joi.string().trim().max(200).allow(null, ''),
  edition: Joi.string().trim().max(50).allow(null, ''),
  language: Joi.string().trim().max(50).allow(null, ''),
  isbn: Joi.string().trim().max(20).allow(null, ''),
  publisher: Joi.string().trim().max(100).allow(null, ''),
  publication_year: Joi.number().integer().min(1000).max(2100).allow(null),
  category_id: Joi.number().integer().allow(null),
  total_copies: Joi.number().integer().min(1).optional(),
  available_copies: Joi.number().integer().min(0).optional(),
  book_location: Joi.string().trim().max(50).allow(null, ''),
  description: Joi.string().allow(null, ''),
  is_active: Joi.boolean().optional(),
  academic_year_id: Joi.number().integer().allow(null),
}).min(1);

const createBookCopySchema = Joi.object({
  book_id: Joi.number().integer().required(),
  accession_number: Joi.string().trim().max(50).required(),
  book_location: Joi.string().trim().max(100).allow(null, ''),
  condition: Joi.string().trim().valid('New', 'Good', 'Damaged', 'Lost', 'Maintenance').optional(),
  copy_price: Joi.number().allow(null),
});

const updateBookCopySchema = Joi.object({
  book_id: Joi.number().integer().optional(),
  accession_number: Joi.string().trim().max(50).optional(),
  book_location: Joi.string().trim().max(100).allow(null, ''),
  condition: Joi.string().trim().valid('New', 'Good', 'Damaged', 'Lost', 'Maintenance').optional(),
  copy_price: Joi.number().allow(null),
}).min(1);

const createMemberSchema = Joi.object({
  student_id: Joi.number().integer().allow(null),
  staff_id: Joi.number().integer().allow(null),
  card_number: Joi.string().trim().max(50).required(),
  academic_year_id: Joi.number().integer().allow(null),
  status: Joi.string().trim().valid('active', 'inactive').optional(),
  remarks: Joi.string().trim().max(2000).allow(null, ''),
});

const updateMemberSchema = Joi.object({
  card_number: Joi.string().trim().max(50).optional(),
  status: Joi.string().trim().valid('active', 'inactive').optional(),
  remarks: Joi.string().trim().max(2000).allow(null, ''),
}).min(1);

const createIssueSchema = Joi.object({
  book_copy_id: Joi.number().integer().allow(null),
  book_id: Joi.number().integer().allow(null),
  library_member_id: Joi.number().integer().required(),
  due_date: Joi.string().trim().required(),
  remarks: Joi.string().trim().max(2000).allow(null, ''),
  policy_id: Joi.number().integer().allow(null),
  condition_on_issue: Joi.string()
    .trim()
    .valid('New', 'Good', 'Damaged', 'Lost', 'Maintenance')
    .allow(null, '')
    .optional(),
  academic_year_id: Joi.number().integer().allow(null),
});

const returnIssueSchema = Joi.object({
  fine_amount: Joi.number().min(0).allow(null),
  remarks: Joi.string().trim().max(2000).allow(null, ''),
  status: Joi.string()
    .valid('returned', 'Returned', 'lost', 'Lost', 'damaged', 'Damaged')
    .optional(),
  condition_on_return: Joi.string()
    .trim()
    .valid('New', 'Good', 'Damaged', 'Lost', 'Maintenance')
    .allow(null, '')
    .optional(),
});

const createReservationSchema = Joi.object({
  library_member_id: Joi.number().integer().required(),
  book_id: Joi.number().integer().required(),
  expiration_date: Joi.string().trim().allow(null, '').optional(),
  academic_year_id: Joi.number().integer().allow(null),
});

const updateReservationSchema = Joi.object({
  status: Joi.string()
    .valid('Cancelled', 'Fulfilled', 'Expired', 'cancelled', 'fulfilled', 'expired')
    .required(),
});

const importBooksRowSchema = Joi.object({
  book_title: Joi.string().trim().max(200).required(),
  category: Joi.alternatives().try(Joi.string().trim().max(200), Joi.number()).allow(null, ''),
  // Backward compatibility for old files; maps to ISBN in controller/parser.
  book_code: Joi.string().trim().max(50).allow(null, ''),
  author: Joi.string().trim().max(200).allow(null, ''),
  edition: Joi.string().trim().max(50).allow(null, ''),
  language: Joi.string().trim().max(50).allow(null, ''),
  isbn: Joi.string().trim().max(20).allow(null, ''),
  publisher: Joi.string().trim().max(100).allow(null, ''),
  publication_year: Joi.number().integer().min(1000).max(2100).allow(null),
  category_id: Joi.number().integer().allow(null),
  category_name: Joi.string().trim().max(100).allow(null, ''),
}).unknown(true);

const importBooksSchema = Joi.object({
  academic_year_id: Joi.number().integer().allow(null),
  books: Joi.array().items(importBooksRowSchema).min(1).max(500).required(),
});

const createPolicySchema = Joi.object({
  policy_name: Joi.string().trim().max(100).required(),
  audience_type: Joi.string().valid('Student', 'Staff', 'ALL').optional(),
  max_books_allowed: Joi.number().integer().min(1).allow(null),
  issue_duration_days: Joi.number().integer().min(1).required(),
  max_renewals_allowed: Joi.number().integer().min(0).allow(null),
  per_day_fine: Joi.number().min(0).allow(null),
  grace_period_days: Joi.number().integer().min(0).allow(null),
  max_fine_limit: Joi.number().min(0).allow(null),
  is_active: Joi.boolean().optional(),
});

const updatePolicySchema = Joi.object({
  policy_name: Joi.string().trim().max(100).optional(),
  audience_type: Joi.string().valid('Student', 'Staff', 'ALL').optional(),
  max_books_allowed: Joi.number().integer().min(1).allow(null),
  issue_duration_days: Joi.number().integer().min(1).optional(),
  max_renewals_allowed: Joi.number().integer().min(0).allow(null),
  per_day_fine: Joi.number().min(0).allow(null),
  grace_period_days: Joi.number().integer().min(0).allow(null),
  max_fine_limit: Joi.number().min(0).allow(null),
  is_active: Joi.boolean().optional(),
}).min(1);

module.exports = {
  createCategorySchema,
  updateCategorySchema,
  createBookSchema,
  updateBookSchema,
  createBookCopySchema,
  updateBookCopySchema,
  createMemberSchema,
  updateMemberSchema,
  createIssueSchema,
  returnIssueSchema,
  createReservationSchema,
  updateReservationSchema,
  importBooksSchema,
  createPolicySchema,
  updatePolicySchema,
};
