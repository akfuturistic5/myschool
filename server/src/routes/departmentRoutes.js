const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
} = require('../controllers/departmentController');

const router = express.Router();

// GET /api/departments
router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllDepartments);

// GET /api/departments/:id
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getDepartmentById);

// PUT /api/departments/:id
router.put('/:id', requireRole([ROLES.ADMIN]), updateDepartment);

module.exports = router;
