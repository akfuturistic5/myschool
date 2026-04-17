const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/rbacMiddleware');
const { PARENT_LIST_ALL_ROLES, PEOPLE_MANAGER_ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  getAllParents,
  getMyParents,
  getParentById,
  getParentByStudentId,
  createParent,
  updateParent,
  uploadParentProfileImage,
  handleParentProfileMulterError,
  createParentWithChild,
} = require('../controllers/parentController');
const { uploadParentProfile } = require('../middleware/parentProfileUploadMulter');
const { validate } = require('../utils/validate');
const { createParentSchema, updateParentSchema, createParentWithChildSchema } = require('../validations/parentValidation');

const router = express.Router();

// Get all parents - Admin only
router.get('/', requireRole(PARENT_LIST_ALL_ROLES), getAllParents);

// Get current logged-in parent's data (must be before /:id)
router.get('/me', authenticate, requireRole(ALL_AUTHENTICATED_ROLES), getMyParents);

// Profile image (must be before /:id)
router.post(
  '/profile-image',
  requireRole(PEOPLE_MANAGER_ROLES),
  uploadParentProfile.single('file'),
  handleParentProfileMulterError,
  uploadParentProfileImage
);

// User-based parent + optional guardian link
router.post(
  '/create-with-child',
  requireRole(PEOPLE_MANAGER_ROLES),
  validate(createParentWithChildSchema),
  createParentWithChild
);

// Create/Update parent - Admin only
router.post('/', requireRole(PEOPLE_MANAGER_ROLES), validate(createParentSchema), createParent);

// Get parent by student ID (must be before /:id)
router.get('/student/:studentId', requireRole(ALL_AUTHENTICATED_ROLES), getParentByStudentId);

// Get parent by ID
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getParentById);

// Update parent by ID - Admin only
router.put('/:id', requireRole(PEOPLE_MANAGER_ROLES), validate(updateParentSchema), updateParent);

module.exports = router;
