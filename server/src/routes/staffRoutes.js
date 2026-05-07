const path = require('path');
const express = require('express');
const multer = require('multer');
const { requireRole, allowDriverOrRoleIds } = require('../middleware/rbacMiddleware');
const { PEOPLE_MANAGER_ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { validate } = require('../utils/validate');
const { staffCreateSchema, staffUpdateSchema } = require('../validations/staffValidation');
const {
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
  uploadStaffDocuments,
  getStaffDocument,
  uploadStaffPhoto,
  getStaffPhoto,
} = require('../controllers/staffController');
const { ensureTenantStaffDocDir } = require('../utils/staffDocumentStorage');
const { ensureTenantStaffProfileDir, sanitizeTenant } = require('../utils/staffProfileStorage');

const router = express.Router();

const staffDocStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const tenant = sanitizeTenant(req.tenant?.db_name || 'default_tenant') || 'default_tenant';
    cb(null, ensureTenantStaffDocDir(tenant));
  },
  filename: (req, file, cb) => {
    const sid = parseInt(req.params.id, 10);
    const field = file.fieldname === 'joining_letter' ? 'joining' : 'resume';
    const safeId = Number.isNaN(sid) ? '0' : String(sid);
    cb(null, `staff_${safeId}_${field}_${Date.now()}.pdf`);
  },
});

const staffDocUpload = multer({
  storage: staffDocStorage,
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

const staffPhotoStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const tenant = sanitizeTenant(req.tenant?.db_name || 'default_tenant') || 'default_tenant';
    cb(null, ensureTenantStaffProfileDir(tenant));
  },
  filename: (req, file, cb) => {
    const sid = parseInt(req.params.id, 10);
    const safeId = Number.isNaN(sid) ? '0' : String(sid);
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `staff_${safeId}_profile_${Date.now()}${ext}`);
  },
});

const staffPhotoUpload = multer({
  storage: staffPhotoStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB for profile photo
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype || '').toLowerCase();
    const ok = mime.startsWith('image/');
    if (!ok) {
      const err = new Error('Only images are allowed (max 2MB).');
      err.statusCode = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

router.post('/', requireRole(PEOPLE_MANAGER_ROLES), validate(staffCreateSchema), createStaff);
router.put('/:id', requireRole(PEOPLE_MANAGER_ROLES), validate(staffUpdateSchema), updateStaff);
router.delete('/:id', requireRole(PEOPLE_MANAGER_ROLES), deleteStaff);

router.get('/', requireRole(PEOPLE_MANAGER_ROLES), getAllStaff);

/**
 * Authenticated users may call this route, but getStaffById enforces:
 * - Headmaster/Administrative (ADMIN_ROLE_IDS), or
 * - The staff row linked to the same user account (self-service profile).
 * Route-level "wide" middleware is required so self-view works for Teacher/Staff logins;
 * do not remove controller checks.
 */
router.get('/:id', allowDriverOrRoleIds(ALL_AUTHENTICATED_ROLES), getStaffById);

router.post(
  '/:id/documents',
  requireRole(PEOPLE_MANAGER_ROLES),
  staffDocUpload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'joining_letter', maxCount: 1 },
  ]),
  uploadStaffDocuments
);

router.get('/:id/documents/:docType', allowDriverOrRoleIds(ALL_AUTHENTICATED_ROLES), getStaffDocument);

router.post('/:id/photo', requireRole(PEOPLE_MANAGER_ROLES), staffPhotoUpload.single('photo'), uploadStaffPhoto);

router.get('/:id/photo/:filename', allowDriverOrRoleIds(ALL_AUTHENTICATED_ROLES), getStaffPhoto);

module.exports = router;
