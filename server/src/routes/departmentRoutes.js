const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
  createDepartment,
  deleteDepartment,
} = require('../controllers/departmentController');

const router = express.Router();

// GET /api/departments
router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllDepartments);

// POST /api/departments — create (admin)
router.post('/', requireRole([ROLES.ADMIN]), createDepartment);

// GET /api/departments/:id
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getDepartmentById);

// PUT /api/departments/:id
router.put('/:id', requireRole([ROLES.ADMIN]), updateDepartment);

// DELETE /api/departments/:id
router.delete('/:id', requireRole([ROLES.ADMIN]), deleteDepartment);

module.exports = router;
