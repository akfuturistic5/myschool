const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { validate } = require('../utils/validate');
const { ACCOUNTS_MANAGER_ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  createIncomeSchema,
  updateIncomeSchema,
  createInvoiceSchema,
  updateInvoiceSchema,
  createExpenseCategorySchema,
  updateExpenseCategorySchema,
  createExpenseSchema,
  updateExpenseSchema,
} = require('../validations/accountsValidation');

const {
  listIncome,
  getIncome,
  createIncome,
  updateIncome,
  deleteIncome,
} = require('../controllers/accountsIncomeController');

const {
  listInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
} = require('../controllers/accountsInvoiceController');

const { listTransactions, getTransaction } = require('../controllers/accountsTransactionController');

const {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/accountsExpenseCategoryController');

const {
  listExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
} = require('../controllers/accountsExpenseController');

const router = express.Router();

const WRITE = ACCOUNTS_MANAGER_ROLES;

router.get('/income', requireRole(ALL_AUTHENTICATED_ROLES), listIncome);
router.get('/income/:id', requireRole(ALL_AUTHENTICATED_ROLES), getIncome);
router.post('/income', requireRole(WRITE), validate(createIncomeSchema), createIncome);
router.put('/income/:id', requireRole(WRITE), validate(updateIncomeSchema), updateIncome);
router.delete('/income/:id', requireRole(WRITE), deleteIncome);

router.get('/invoices', requireRole(ALL_AUTHENTICATED_ROLES), listInvoices);
router.get('/invoices/:id', requireRole(ALL_AUTHENTICATED_ROLES), getInvoice);
router.post('/invoices', requireRole(WRITE), validate(createInvoiceSchema), createInvoice);
router.put('/invoices/:id', requireRole(WRITE), validate(updateInvoiceSchema), updateInvoice);
router.delete('/invoices/:id', requireRole(WRITE), deleteInvoice);

router.get('/transactions', requireRole(ALL_AUTHENTICATED_ROLES), listTransactions);
router.get('/transactions/:id', requireRole(ALL_AUTHENTICATED_ROLES), getTransaction);

router.get('/expense-categories', requireRole(ALL_AUTHENTICATED_ROLES), listCategories);
router.get('/expense-categories/:id', requireRole(ALL_AUTHENTICATED_ROLES), getCategory);
router.post('/expense-categories', requireRole(WRITE), validate(createExpenseCategorySchema), createCategory);
router.put('/expense-categories/:id', requireRole(WRITE), validate(updateExpenseCategorySchema), updateCategory);
router.delete('/expense-categories/:id', requireRole(WRITE), deleteCategory);

router.get('/expenses', requireRole(ALL_AUTHENTICATED_ROLES), listExpenses);
router.get('/expenses/:id', requireRole(ALL_AUTHENTICATED_ROLES), getExpense);
router.post('/expenses', requireRole(WRITE), validate(createExpenseSchema), createExpense);
router.put('/expenses/:id', requireRole(WRITE), validate(updateExpenseSchema), updateExpense);
router.delete('/expenses/:id', requireRole(WRITE), deleteExpense);

module.exports = router;
