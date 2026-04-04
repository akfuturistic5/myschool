const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { TEACHER_LIST_ALL_ROLES, PEOPLE_MANAGER_ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { getAllTeachers, getCurrentTeacher, getTeacherById, getTeachersByClass, getTeacherRoutine, getTeacherClassAttendance, createTeacher, updateTeacher } = require('../controllers/teacherController');

const router = express.Router();

// Get all teachers - Admin only
router.get('/', requireRole(TEACHER_LIST_ALL_ROLES), getAllTeachers);

// Create teacher - Admin / Administrative
router.post('/', requireRole(PEOPLE_MANAGER_ROLES), createTeacher);

// Get current logged-in teacher (must be before /:id route)
router.get('/me', requireRole(ALL_AUTHENTICATED_ROLES), getCurrentTeacher);

// Get teachers by class
router.get('/class/:classId', requireRole(ALL_AUTHENTICATED_ROLES), getTeachersByClass);

// Get teacher routine (must be before /:id route)
router.get('/:id/routine', requireRole(ALL_AUTHENTICATED_ROLES), getTeacherRoutine);

// Get attendance for students in teacher's classes (Teacher Dashboard)
router.get('/:id/class-attendance', requireRole(ALL_AUTHENTICATED_ROLES), getTeacherClassAttendance);

// Update teacher - Admin only
router.put('/:id', requireRole(PEOPLE_MANAGER_ROLES), updateTeacher);

// Get teacher by ID
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getTeacherById);

module.exports = router;
