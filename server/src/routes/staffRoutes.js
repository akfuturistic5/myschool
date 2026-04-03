const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { PEOPLE_MANAGER_ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { getAllStaff, getStaffById } = require('../controllers/staffController');

const router = express.Router();

// GET /api/staff
router.get('/', requireRole(PEOPLE_MANAGER_ROLES), getAllStaff);

// GET /api/staff/:id
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getStaffById);

module.exports = router;

