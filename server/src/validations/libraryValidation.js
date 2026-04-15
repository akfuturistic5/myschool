const Joi = require('joi');

const createCategorySchema = Joi.object({
  category_name: Joi.string().trim().max(100).required(),
  description: Joi.string().trim().max(2000).allow(null, ''),
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
  isbn: Joi.string().trim().max(20).allow(null, ''),
  publisher: Joi.string().trim().max(100).allow(null, ''),
  publication_year: Joi.number().integer().min(1000).max(2100).allow(null),
  category_id: Joi.number().integer().allow(null),
  total_copies: Joi.number().integer().min(1).optional(),
  available_copies: Joi.number().integer().min(0).optional(),
  book_price: Joi.number().allow(null),
  book_location: Joi.string().trim().max(50).allow(null, ''),
  description: Joi.string().allow(null, ''),
  academic_year_id: Joi.number().integer().allow(null),
});

const updateBookSchema = Joi.object({
  book_title: Joi.string().trim().max(200).optional(),
  book_code: Joi.string().trim().max(50).allow(null, ''),
  author: Joi.string().trim().max(200).allow(null, ''),
  isbn: Joi.string().trim().max(20).allow(null, ''),
  publisher: Joi.string().trim().max(100).allow(null, ''),
  publication_year: Joi.number().integer().min(1000).max(2100).allow(null),
  category_id: Joi.number().integer().allow(null),
  total_copies: Joi.number().integer().min(1).optional(),
  available_copies: Joi.number().integer().min(0).optional(),
  book_price: Joi.number().allow(null),
  book_location: Joi.string().trim().max(50).allow(null, ''),
  description: Joi.string().allow(null, ''),
  is_active: Joi.boolean().optional(),
  academic_year_id: Joi.number().integer().allow(null),
}).min(1);

const createMemberSchema = Joi.object({
  member_type: Joi.string().valid('student', 'staff').required(),
  student_id: Joi.number().integer().when('member_type', {
    is: 'student',
    then: Joi.required(),
    otherwise: Joi.allow(null),
  }),
  staff_id: Joi.number().integer().when('member_type', {
    is: 'staff',
    then: Joi.required(),
    otherwise: Joi.allow(null),
  }),
  card_number: Joi.string().trim().max(50).required(),
  date_joined: Joi.string().trim().allow(null, ''),
  academic_year_id: Joi.number().integer().allow(null),
});

const updateMemberSchema = Joi.object({
  card_number: Joi.string().trim().max(50).optional(),
  date_joined: Joi.string().trim().allow(null, ''),
  is_active: Joi.boolean().optional(),
  academic_year_id: Joi.number().integer().allow(null),
}).min(1);

const createIssueSchema = Joi.object({
  book_id: Joi.number().integer().required(),
  library_member_id: Joi.number().integer().required(),
  due_date: Joi.string().trim().required(),
  remarks: Joi.string().trim().max(2000).allow(null, ''),
});

const returnIssueSchema = Joi.object({
  fine_amount: Joi.number().min(0).allow(null),
  remarks: Joi.string().trim().max(2000).allow(null, ''),
  status: Joi.string().valid('returned', 'lost', 'damaged').optional(),
});

const importBooksRowSchema = Joi.object({
  book_title: Joi.string().trim().max(200).required(),
  category: Joi.alternatives().try(Joi.string().trim().max(200), Joi.number()).allow(null, ''),
  book_code: Joi.string().trim().max(50).allow(null, ''),
  author: Joi.string().trim().max(200).allow(null, ''),
  isbn: Joi.string().trim().max(20).allow(null, ''),
  publisher: Joi.string().trim().max(100).allow(null, ''),
  publication_year: Joi.number().integer().min(1000).max(2100).allow(null),
  category_id: Joi.number().integer().allow(null),
  category_name: Joi.string().trim().max(100).allow(null, ''),
  total_copies: Joi.number().integer().min(1).allow(null),
  available_copies: Joi.number().integer().min(0).optional(),
  book_price: Joi.number().allow(null),
  book_location: Joi.string().trim().max(50).allow(null, ''),
  description: Joi.string().allow(null, ''),
}).unknown(true);

const importBooksSchema = Joi.object({
  academic_year_id: Joi.number().integer().allow(null),
  books: Joi.array().items(importBooksRowSchema).min(1).max(500).required(),
});

module.exports = {
  createCategorySchema,
  updateCategorySchema,
  createBookSchema,
  updateBookSchema,
  createMemberSchema,
  updateMemberSchema,
  createIssueSchema,
  returnIssueSchema,
  importBooksSchema,
};
