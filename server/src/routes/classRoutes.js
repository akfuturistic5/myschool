const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { getAllClasses, getClassById, getClassesByAcademicYear, updateClass } = require('../controllers/classController');

const router = express.Router();

// Get all classes
router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllClasses);

// Get classes by academic year (must be before /:id)
router.get('/academic-year/:academicYearId', requireRole(ALL_AUTHENTICATED_ROLES), getClassesByAcademicYear);

// Get class by ID
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getClassById);

// Update class
router.put('/:id', requireRole([ROLES.ADMIN]), updateClass);

module.exports = router;
