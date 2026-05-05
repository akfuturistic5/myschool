const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ALL_AUTHENTICATED_ROLES, ADMIN_ROLE_IDS } = require('../config/roles');
const { 
  getAllClassSubjects, 
  getSubjectsByClass, 
  assignSubjectToClass, 
  updateClassSubject, 
  removeClassSubject 
} = require('../controllers/classSubjectController');
const { validate } = require('../utils/validate');
const { classSubjectAssignSchema, classSubjectUpdateSchema } = require('../validations/classSubjectValidation');

const router = express.Router();

// Get all class-subject assignments
router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllClassSubjects);

// Get subjects for a specific class (Curriculum lookup)
router.get('/class/:classId', requireRole(ALL_AUTHENTICATED_ROLES), getSubjectsByClass);

// Assign subject to class (Admin only)
router.post('/', requireRole(ADMIN_ROLE_IDS), validate(classSubjectAssignSchema), assignSubjectToClass);

// Update assignment (Admin only)
router.put('/:id', requireRole(ADMIN_ROLE_IDS), validate(classSubjectUpdateSchema), updateClassSubject);

// Remove assignment (Admin only)
router.delete('/:id', requireRole(ADMIN_ROLE_IDS), removeClassSubject);

module.exports = router;
