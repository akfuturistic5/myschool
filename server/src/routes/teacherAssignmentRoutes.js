const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { PEOPLE_MANAGER_ROLES, TEACHER_LIST_ALL_ROLES } = require('../config/roles');
const {
  listTeacherAssignments,
  getClassAssignmentMetaHandler,
  createTeacherAssignment,
  updateTeacherAssignment,
  deleteTeacherAssignment,
} = require('../controllers/teacherAssignmentController');

const router = express.Router();

router.get('/class/:classId/meta', requireRole(TEACHER_LIST_ALL_ROLES), getClassAssignmentMetaHandler);
router.get('/', requireRole(TEACHER_LIST_ALL_ROLES), listTeacherAssignments);
router.post('/', requireRole(PEOPLE_MANAGER_ROLES), createTeacherAssignment);
router.put('/:id', requireRole(PEOPLE_MANAGER_ROLES), updateTeacherAssignment);
router.delete('/:id', requireRole(PEOPLE_MANAGER_ROLES), deleteTeacherAssignment);

module.exports = router;
