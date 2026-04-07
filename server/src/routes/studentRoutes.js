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
  promoteStudents,
  leaveStudents,
  getStudentPromotions,
  getLeavingStudents,
  getStudentAttendance,
  getStudentLoginDetails,
  getStudentExamResults,
  getGradeReport,
  getAttendanceReport,
} = require('../controllers/studentController');
const { downloadBonafide } = require('../controllers/bonafideController');
const { validate } = require('../utils/validate');
const { createStudentSchema, updateStudentSchema, promoteStudentsSchema, leaveStudentsSchema } = require('../validations/studentValidation');

const router = express.Router();

// Get all students - Admin/Administrative/Teacher
router.get('/', requireRole(STUDENT_LIST_ALL_ROLES), getAllStudents);

// Get students for current teacher - Teacher only
router.get('/teacher/students', requireRole([ROLES.TEACHER]), getTeacherStudents);

// Bulk promote students (must be before /:id)
router.post(
  '/promote',
  requireRole(PEOPLE_MANAGER_ROLES),
  validate(promoteStudentsSchema),
  promoteStudents
);

// Bulk mark students as leaving (must be before /:id)
router.post(
  '/leave',
  requireRole(PEOPLE_MANAGER_ROLES),
  validate(leaveStudentsSchema),
  leaveStudents
);

// Student promotion history
router.get('/promotions', requireRole(STUDENT_LIST_ALL_ROLES), getStudentPromotions);
router.get('/leaving', requireRole(STUDENT_LIST_ALL_ROLES), getLeavingStudents);

// Get current logged-in student (must be before /:id)
router.get('/me', requireRole(ALL_AUTHENTICATED_ROLES), getCurrentStudent);

// Get students by class - Admin or Teacher
router.get('/class/:classId', requireRole(STUDENT_LIST_ALL_ROLES), getStudentsByClass);

// Report endpoints - Admin/Administrative/Teacher
router.get('/reports/grade', requireRole(STUDENT_LIST_ALL_ROLES), getGradeReport);
router.get('/reports/attendance', requireRole(STUDENT_LIST_ALL_ROLES), getAttendanceReport);

// Get login details (usernames) for a student
// Auth is handled by protectApi globally; controller enforces ownership (admin / student / parent / guardian)
router.get('/:id/login-details', requireRole(ALL_AUTHENTICATED_ROLES), getStudentLoginDetails);

// Download dynamic Bonafide certificate (PDF)
router.get('/:id/bonafide', requireRole(ALL_AUTHENTICATED_ROLES), downloadBonafide);

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
