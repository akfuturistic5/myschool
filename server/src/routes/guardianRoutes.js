const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { validate } = require('../utils/validate');
const { createGuardianSchema, updateGuardianSchema } = require('../validations/guardianValidation');
const { GUARDIAN_LIST_ALL_ROLES, PEOPLE_MANAGER_ROLES } = require('../config/roles');
const { createGuardian, updateGuardian, getAllGuardians, getCurrentGuardian, getGuardianById, getGuardianByStudentId } = require('../controllers/guardianController');

const router = express.Router();

// Create guardian - Admin only
router.post('/', requireRole(PEOPLE_MANAGER_ROLES), validate(createGuardianSchema), createGuardian);

// Get all guardians - Admin only
router.get('/', requireRole(GUARDIAN_LIST_ALL_ROLES), getAllGuardians);

// Get current logged-in guardian (must be before /:id)
router.get('/me', getCurrentGuardian);

// Update guardian - Admin only
router.put('/:id', requireRole(PEOPLE_MANAGER_ROLES), validate(updateGuardianSchema), updateGuardian);

// Get guardian by ID
router.get('/:id', getGuardianById);

// Get guardian by student ID
router.get('/student/:studentId', getGuardianByStudentId);

module.exports = router;
