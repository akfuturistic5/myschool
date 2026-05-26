const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { validate } = require('../utils/validate');
const {
  designationCreateSchema,
  designationUpdateSchema,
} = require('../validations/designationValidation');
const {
  getAllDesignations,
  getDesignationById,
  createDesignation,
  updateDesignation,
  deleteDesignation,
} = require('../controllers/designationController');

const router = express.Router();

// GET /api/designations
router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllDesignations);

// POST /api/designations — create (admin)
router.post(
  '/',
  requireRole([ROLES.ADMIN]),
  validate(designationCreateSchema),
  createDesignation
);

// GET /api/designations/:id
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getDesignationById);

// PUT /api/designations/:id
router.put(
  '/:id',
  requireRole([ROLES.ADMIN]),
  validate(designationUpdateSchema),
  updateDesignation
);

// DELETE /api/designations/:id
router.delete('/:id', requireRole([ROLES.ADMIN]), deleteDesignation);

module.exports = router;
