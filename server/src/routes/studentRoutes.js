const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ROLES, STUDENT_LIST_ALL_ROLES, PEOPLE_MANAGER_ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  getAllStudents,
  getTeacherStudents,
  getStudentById,
  getCurrentStudent,
  getStudentsByClass,
  createStudent,
  updateStudent,
  getStudentAttendance,
  getStudentLoginDetails,
  getStudentExamResults,
} = require('../controllers/studentController');
const { validate } = require('../utils/validate');
const { createStudentSchema, updateStudentSchema } = require('../validations/studentValidation');

const router = express.Router();

// Get all students - Admin only
router.get('/', requireRole([ROLES.ADMIN]), getAllStudents);

// Get students for current teacher - Teacher only
router.get('/teacher/students', requireRole([ROLES.TEACHER]), getTeacherStudents);

// Get current logged-in student (must be before /:id)
router.get('/me', requireRole(ALL_AUTHENTICATED_ROLES), getCurrentStudent);

// Get students by class - Admin or Teacher
router.get('/class/:classId', requireRole(STUDENT_LIST_ALL_ROLES), getStudentsByClass);

// Get login details (usernames) for a student
// Auth is handled by protectApi globally; controller enforces ownership (admin / student / parent / guardian)
router.get('/:id/login-details', requireRole(ALL_AUTHENTICATED_ROLES), getStudentLoginDetails);

// Get student attendance
router.get('/:studentId/attendance', requireRole(ALL_AUTHENTICATED_ROLES), getStudentAttendance);

// Get student exam results (read-only, DB-backed)
router.get('/:studentId/exam-results', requireRole(ALL_AUTHENTICATED_ROLES), getStudentExamResults);

// Get student by ID
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getStudentById);

// Create/Update student - Admin only
router.post('/', requireRole(PEOPLE_MANAGER_ROLES), validate(createStudentSchema), createStudent);
router.put('/:id', requireRole(PEOPLE_MANAGER_ROLES), validate(updateStudentSchema), updateStudent);

module.exports = router;
