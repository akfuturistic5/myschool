const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { validate } = require('../utils/validate');
const { LIBRARY_MANAGER_ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  createCategorySchema,
  updateCategorySchema,
  createBookSchema,
  updateBookSchema,
  createMemberSchema,
  updateMemberSchema,
  createIssueSchema,
  returnIssueSchema,
  importBooksSchema,
} = require('../validations/libraryValidation');

const {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/libraryCategoryController');

const {
  listBooks,
  getBook,
  createBook,
  updateBook,
  deleteBook,
  importBooks,
} = require('../controllers/libraryBookController');

const {
  listMembers,
  getMember,
  createMember,
  updateMember,
  deleteMember,
} = require('../controllers/libraryMemberController');

const { listIssues, getIssue, createIssue, returnIssue } = require('../controllers/libraryIssueController');

const router = express.Router();

router.get('/categories', requireRole(ALL_AUTHENTICATED_ROLES), listCategories);
router.get('/categories/:id', requireRole(ALL_AUTHENTICATED_ROLES), getCategory);
router.post('/categories', requireRole(LIBRARY_MANAGER_ROLES), validate(createCategorySchema), createCategory);
router.put('/categories/:id', requireRole(LIBRARY_MANAGER_ROLES), validate(updateCategorySchema), updateCategory);
router.delete('/categories/:id', requireRole(LIBRARY_MANAGER_ROLES), deleteCategory);

router.get('/books', requireRole(ALL_AUTHENTICATED_ROLES), listBooks);
router.post('/books/import', requireRole(LIBRARY_MANAGER_ROLES), validate(importBooksSchema), importBooks);
router.get('/books/:id', requireRole(ALL_AUTHENTICATED_ROLES), getBook);
router.post('/books', requireRole(LIBRARY_MANAGER_ROLES), validate(createBookSchema), createBook);
router.put('/books/:id', requireRole(LIBRARY_MANAGER_ROLES), validate(updateBookSchema), updateBook);
router.delete('/books/:id', requireRole(LIBRARY_MANAGER_ROLES), deleteBook);

router.get('/members', requireRole(ALL_AUTHENTICATED_ROLES), listMembers);
router.get('/members/:id', requireRole(ALL_AUTHENTICATED_ROLES), getMember);
router.post('/members', requireRole(LIBRARY_MANAGER_ROLES), validate(createMemberSchema), createMember);
router.put('/members/:id', requireRole(LIBRARY_MANAGER_ROLES), validate(updateMemberSchema), updateMember);
router.delete('/members/:id', requireRole(LIBRARY_MANAGER_ROLES), deleteMember);

router.get('/issues', requireRole(ALL_AUTHENTICATED_ROLES), listIssues);
router.post('/issues', requireRole(LIBRARY_MANAGER_ROLES), validate(createIssueSchema), createIssue);
router.patch('/issues/:id/return', requireRole(LIBRARY_MANAGER_ROLES), validate(returnIssueSchema), returnIssue);
router.get('/issues/:id', requireRole(ALL_AUTHENTICATED_ROLES), getIssue);

module.exports = router;
