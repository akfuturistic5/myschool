const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { validate } = require('../utils/validate');
const { ALL_AUTHENTICATED_ROLES, ROLES } = require('../config/roles');
const { subjectCreateSchema, subjectUpdateSchema } = require('../validations/subjectValidation');
const { getAllSubjects, getSubjectById, getSubjectsByClass, createSubject, updateSubject, deleteSubject } = require('../controllers/subjectController');

const router = express.Router();

// Get all subjects
router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllSubjects);

// Get subjects by class (must be before /:id)
router.get('/class/:classId', requireRole(ALL_AUTHENTICATED_ROLES), getSubjectsByClass);

router.post('/', requireRole([ROLES.ADMIN]), validate(subjectCreateSchema), createSubject);
// Update subject
router.put('/:id', requireRole([ROLES.ADMIN]), validate(subjectUpdateSchema), updateSubject);
router.delete('/:id', requireRole([ROLES.ADMIN]), deleteSubject);

// Get subject by ID
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getSubjectById);

module.exports = router;
