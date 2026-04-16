const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { USER_MANAGER_ROLES, PEOPLE_MANAGER_ROLES } = require('../config/roles');
const {
  getAllUsers,
  getDeleteAccountRequests,
  getUserById,
  checkUserUnique,
} = require('../controllers/userController');

const router = express.Router();

/** Admin + Administrative (+ overlap with USER_MANAGER) — forms that need uniqueness (parents, teachers, users) */
const UNIQUE_CHECK_ROLES = [...new Set([...USER_MANAGER_ROLES, ...PEOPLE_MANAGER_ROLES])];

// GET /api/users/check-unique — must be before /:id
router.get('/check-unique', requireRole(UNIQUE_CHECK_ROLES), checkUserUnique);

// GET /api/users - Admin only
router.get('/', requireRole(USER_MANAGER_ROLES), getAllUsers);

// GET /api/users/delete-account-requests - Admin only
router.get('/delete-account-requests', requireRole(USER_MANAGER_ROLES), getDeleteAccountRequests);

// GET /api/users/:id - Admin only
router.get('/:id', requireRole(USER_MANAGER_ROLES), getUserById);

module.exports = router;
