const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/rbacMiddleware');
const { PARENT_LIST_ALL_ROLES, PEOPLE_MANAGER_ROLES } = require('../config/roles');
const { getAllParents, getMyParents, getParentById, getParentByStudentId, createParent, updateParent } = require('../controllers/parentController');
const { validate } = require('../utils/validate');
const { createParentSchema, updateParentSchema } = require('../validations/parentValidation');

const router = express.Router();

// Get all parents - Admin only
router.get('/', requireRole(PARENT_LIST_ALL_ROLES), getAllParents);

// Get current logged-in parent's data (must be before /:id)
router.get('/me', authenticate, getMyParents);

// Create/Update parent - Admin only
router.post('/', requireRole(PEOPLE_MANAGER_ROLES), validate(createParentSchema), createParent);

// Get parent by student ID (must be before /:id)
router.get('/student/:studentId', getParentByStudentId);

// Get parent by ID
router.get('/:id', getParentById);

// Update parent by ID - Admin only
router.put('/:id', requireRole(PEOPLE_MANAGER_ROLES), validate(updateParentSchema), updateParent);

module.exports = router;
