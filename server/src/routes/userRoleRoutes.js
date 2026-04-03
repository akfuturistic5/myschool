const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { getAllUserRoles, getUserRoleById } = require('../controllers/userRoleController');

const router = express.Router();

// GET /api/user-roles
router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllUserRoles);

// GET /api/user-roles/:id
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getUserRoleById);

module.exports = router;
