const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { getAllSections, getSectionById, getSectionsByClass, updateSection } = require('../controllers/sectionController');

const router = express.Router();

// Get all sections
router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllSections);

// Get sections by class (must be before /:id)
router.get('/class/:classId', requireRole(ALL_AUTHENTICATED_ROLES), getSectionsByClass);

// Update section
router.put('/:id', requireRole([ROLES.ADMIN]), updateSection);

// Get section by ID (must be after /class/:classId)
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getSectionById);

module.exports = router;
