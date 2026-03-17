const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { getAllStaff, getStaffById } = require('../controllers/staffController');

const router = express.Router();

// GET /api/staff
router.get('/', requireRole([ROLES.ADMIN]), getAllStaff);

// GET /api/staff/:id
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getStaffById);

module.exports = router;

