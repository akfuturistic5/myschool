const path = require('path');
const express = require('express');
const multer = require('multer');
const { requireRole } = require('../middleware/rbacMiddleware');
const { TEACHER_LIST_ALL_ROLES, PEOPLE_MANAGER_ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  getAllTeachers,
  getCurrentTeacher,
  getTeacherById,
  getTeachersByClass,
  getTeacherRoutine,
  getTeacherClassAttendance,
  createTeacher,
  updateTeacher,
  uploadTeacherDocuments,
  getTeacherDocument,
} = require('../controllers/teacherController');
const { ensureTenantTeacherDocDir, sanitizeTenant } = require('../utils/teacherDocumentStorage');

const router = express.Router();

const teacherDocStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const tenant = sanitizeTenant(req.tenant?.db_name || 'default_tenant') || 'default_tenant';
    cb(null, ensureTenantTeacherDocDir(tenant));
  },
  filename: (req, file, cb) => {
    const tid = parseInt(req.params.id, 10);
    const field = file.fieldname === 'joining_letter' ? 'joining' : 'resume';
    const safeId = Number.isNaN(tid) ? '0' : String(tid);
    cb(null, `teacher_${safeId}_${field}_${Date.now()}.pdf`);
  },
});

const teacherDocUpload = multer({
  storage: teacherDocStorage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype || '').toLowerCase();
    const ext = path.extname(file.originalname || '').toLowerCase();
    const ok = mime === 'application/pdf' || ext === '.pdf';
    if (!ok) {
      const err = new Error('Only PDF files are allowed (max 4MB).');
      err.statusCode = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

// Get all teachers - Admin only
router.get('/', requireRole(TEACHER_LIST_ALL_ROLES), getAllTeachers);

// Create teacher - Admin / Administrative
router.post('/', requireRole(PEOPLE_MANAGER_ROLES), createTeacher);

// Get current logged-in teacher (must be before /:id route)
router.get('/me', requireRole(ALL_AUTHENTICATED_ROLES), getCurrentTeacher);

// Get teachers by class (before /:id/* so "class" is not captured as id)
router.get('/class/:classId', requireRole(ALL_AUTHENTICATED_ROLES), getTeachersByClass);

// Teacher PDF documents (before generic GET /:id)
router.get('/:id/documents/:docType', requireRole(ALL_AUTHENTICATED_ROLES), getTeacherDocument);
router.post(
  '/:id/documents',
  requireRole(PEOPLE_MANAGER_ROLES),
  (req, res, next) => {
    teacherDocUpload.fields([
      { name: 'resume', maxCount: 1 },
      { name: 'joining_letter', maxCount: 1 },
    ])(req, res, (err) => {
      if (err) {
        const msg =
          err.code === 'LIMIT_FILE_SIZE'
            ? 'File too large (max 4MB).'
            : err.message || 'Upload failed';
        return res.status(400).json({
          success: false,
          status: 'ERROR',
          code: 'VALIDATION_ERROR',
          errorCode: 'VALIDATION_ERROR',
          message: msg,
        });
      }
      next();
    });
  },
  uploadTeacherDocuments
);

// Get teacher routine (must be before /:id route)
router.get('/:id/routine', requireRole(ALL_AUTHENTICATED_ROLES), getTeacherRoutine);

// Get attendance for students in teacher's classes (Teacher Dashboard)
router.get('/:id/class-attendance', requireRole(ALL_AUTHENTICATED_ROLES), getTeacherClassAttendance);

// Update teacher - Admin only
router.put('/:id', requireRole(PEOPLE_MANAGER_ROLES), updateTeacher);

// Get teacher by ID
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getTeacherById);

module.exports = router;
