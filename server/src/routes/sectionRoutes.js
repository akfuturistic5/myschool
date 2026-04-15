const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { validate } = require('../utils/validate');
const { ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { sectionCreateSchema, sectionUpdateSchema } = require('../validations/sectionValidation');
const { getAllSections, getSectionById, getSectionsByClass, createSection, updateSection, deleteSection } = require('../controllers/sectionController');

const router = express.Router();

// Get all sections
router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllSections);

// Get sections by class (must be before /:id)
router.get('/class/:classId', requireRole(ALL_AUTHENTICATED_ROLES), getSectionsByClass);

router.post('/', requireRole([ROLES.ADMIN]), validate(sectionCreateSchema), createSection);
// Update section
router.put('/:id', requireRole([ROLES.ADMIN]), validate(sectionUpdateSchema), updateSection);
router.delete('/:id', requireRole([ROLES.ADMIN]), deleteSection);

// Get section by ID (must be after /class/:classId)
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getSectionById);

module.exports = router;
