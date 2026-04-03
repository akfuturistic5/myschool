const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { getAllDesignations, getDesignationById, updateDesignation } = require('../controllers/designationController');

const router = express.Router();

// GET /api/designations
router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllDesignations);

// PUT /api/designations/:id
router.put('/:id', requireRole([ROLES.ADMIN]), updateDesignation);

// GET /api/designations/:id
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getDesignationById);

module.exports = router;
