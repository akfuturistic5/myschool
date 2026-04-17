const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ALL_AUTHENTICATED_ROLES, USER_MANAGER_ROLES } = require('../config/roles');
const {
  getAllUserRoles,
  getUserRoleById,
  createUserRole,
  updateUserRole,
  deleteUserRole,
} = require('../controllers/userRoleController');

const router = express.Router();

// GET /api/user-roles
router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllUserRoles);

// GET /api/user-roles/:id
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getUserRoleById);
// POST /api/user-roles
router.post('/', requireRole(USER_MANAGER_ROLES), createUserRole);
// PUT /api/user-roles/:id
router.put('/:id', requireRole(USER_MANAGER_ROLES), updateUserRole);
// DELETE /api/user-roles/:id
router.delete('/:id', requireRole(USER_MANAGER_ROLES), deleteUserRole);

module.exports = router;
