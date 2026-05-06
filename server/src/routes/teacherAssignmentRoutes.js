const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { PEOPLE_MANAGER_ROLES, TEACHER_LIST_ALL_ROLES } = require('../config/roles');
const {
  getClassAssignmentMetaHandler,
  // Class Teachers
  listClassTeacherAssignments,
  createClassTeacherAssignment,
  updateClassTeacherAssignment,
  deleteClassTeacherAssignment,
  // Subject Teachers
  listSubjectTeacherAssignments,
  createSubjectTeacherAssignment,
  updateSubjectTeacherAssignment,
  deleteSubjectTeacherAssignment,
} = require('../controllers/teacherAssignmentController');

const router = express.Router();

router.get('/class/:classId/meta', requireRole(TEACHER_LIST_ALL_ROLES), getClassAssignmentMetaHandler);

// Class Teacher Assignments
router.get('/class-teachers', requireRole(TEACHER_LIST_ALL_ROLES), listClassTeacherAssignments);
router.post('/class-teachers', requireRole(PEOPLE_MANAGER_ROLES), createClassTeacherAssignment);
router.put('/class-teachers/:id', requireRole(PEOPLE_MANAGER_ROLES), updateClassTeacherAssignment);
router.delete('/class-teachers/:id', requireRole(PEOPLE_MANAGER_ROLES), deleteClassTeacherAssignment);

// Subject Teacher Assignments
router.get('/subject-teachers', requireRole(TEACHER_LIST_ALL_ROLES), listSubjectTeacherAssignments);
router.post('/subject-teachers', requireRole(PEOPLE_MANAGER_ROLES), createSubjectTeacherAssignment);
router.put('/subject-teachers/:id', requireRole(PEOPLE_MANAGER_ROLES), updateSubjectTeacherAssignment);
router.delete('/subject-teachers/:id', requireRole(PEOPLE_MANAGER_ROLES), deleteSubjectTeacherAssignment);

module.exports = router;
