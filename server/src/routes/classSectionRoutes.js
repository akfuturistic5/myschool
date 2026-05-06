const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { validate } = require('../utils/validate');
const { ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { assignSectionsSchema } = require('../validations/classSectionValidation');
const {
  getSectionsByClass,
  assignSectionsToClass,
  updateClassSection,
  removeSectionFromClass,
  getClassSectionsSummary,
} = require('../controllers/classSectionController');

const router = express.Router();

// Get sections by class
router.get('/class/:classId', requireRole(ALL_AUTHENTICATED_ROLES), getSectionsByClass);

// Get summary for all classes
router.get('/summary', requireRole(ALL_AUTHENTICATED_ROLES), getClassSectionsSummary);

// Assign sections to class
router.post('/assign', requireRole([ROLES.ADMIN]), validate(assignSectionsSchema), assignSectionsToClass);

// Update a specific assignment
router.put('/:id', requireRole([ROLES.ADMIN]), updateClassSection);

// Remove a specific assignment
router.delete('/:id', requireRole([ROLES.ADMIN]), removeSectionFromClass);

module.exports = router;
