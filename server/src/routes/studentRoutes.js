const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { STUDENT_LIST_ALL_ROLES, PEOPLE_MANAGER_ROLES } = require('../config/roles');
const {
  getAllStudents,
  getStudentById,
  getCurrentStudent,
  getStudentsByClass,
  createStudent,
  updateStudent,
  getStudentAttendance,
} = require('../controllers/studentController');
const { validate } = require('../utils/validate');
const { createStudentSchema, updateStudentSchema } = require('../validations/studentValidation');

const router = express.Router();

// Get all students - Admin only
router.get('/', requireRole(STUDENT_LIST_ALL_ROLES), getAllStudents);

// Get current logged-in student (must be before /:id)
router.get('/me', getCurrentStudent);

// Get students by class - Admin or Teacher
router.get('/class/:classId', getStudentsByClass);

// Get student attendance
router.get('/:studentId/attendance', getStudentAttendance);

// Get student by ID
router.get('/:id', getStudentById);

// Create/Update student - Admin only
router.post('/', requireRole(PEOPLE_MANAGER_ROLES), validate(createStudentSchema), createStudent);
router.put('/:id', requireRole(PEOPLE_MANAGER_ROLES), validate(updateStudentSchema), updateStudent);

module.exports = router;
