const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { USER_MANAGER_ROLES } = require('../config/roles');
const { getAllUsers, getUserById } = require('../controllers/userController');

const router = express.Router();

// GET /api/users - Admin only
router.get('/', requireRole(USER_MANAGER_ROLES), getAllUsers);

// GET /api/users/:id - Admin only
router.get('/:id', requireRole(USER_MANAGER_ROLES), getUserById);

module.exports = router;
