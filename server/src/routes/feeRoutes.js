const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { validate } = require('../utils/validate');
const { createFeeCollectionSchema } = require('../validations/feeValidation');
const { FEE_MANAGER_ROLES, FEE_COLLECTIONS_LIST_ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  getFeeCollectionsList,
  getStudentFees,
  getFeeStructures,
  createFeeCollection,
} = require('../controllers/feeController');

const router = express.Router();

// Admin/Finance only - list all fee collections
router.get('/collections', requireRole(FEE_COLLECTIONS_LIST_ROLES), getFeeCollectionsList);
// Fee structures - all authenticated users (for dropdowns)
router.get('/structures', requireRole(ALL_AUTHENTICATED_ROLES), getFeeStructures);
// Student fees - controller enforces ownership (Admin, or student own, or parent children)
router.get('/student/:studentId', requireRole(ALL_AUTHENTICATED_ROLES), getStudentFees);
// Admin/Finance only - create fee collection
router.post('/collect', requireRole(FEE_MANAGER_ROLES), validate(createFeeCollectionSchema), createFeeCollection);

module.exports = router;
