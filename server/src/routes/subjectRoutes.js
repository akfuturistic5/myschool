const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ALL_AUTHENTICATED_ROLES, ROLES } = require('../config/roles');
const { getAllSubjects, getSubjectById, getSubjectsByClass, updateSubject } = require('../controllers/subjectController');

const router = express.Router();

// Get all subjects
router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllSubjects);

// Update subject
router.put('/:id', requireRole([ROLES.ADMIN]), updateSubject);

// Get subject by ID
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getSubjectById);

// Get subjects by class
router.get('/class/:classId', requireRole(ALL_AUTHENTICATED_ROLES), getSubjectsByClass);

module.exports = router;
