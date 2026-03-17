const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { getAllAcademicYears, getAcademicYearById } = require('../controllers/academicYearController');

const router = express.Router();

// Get all academic years (for dropdowns)
router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllAcademicYears);

// Get academic year by ID
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getAcademicYearById);

module.exports = router;
