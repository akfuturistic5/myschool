const express = require('express');
const Joi = require('joi');
const { validate } = require('../utils/validate');
const { authenticateSuperAdmin, requireSuperAdmin } = require('../middleware/superAdminAuthMiddleware');
const {
  listSchools,
  getSchoolById,
  updateSchoolStatus,
  getPlatformStats,
  createSchool,
  updateSchoolMetadata,
  requestSchoolDeleteToken,
  confirmDeleteSchool,
} = require('../controllers/superAdminController');
const { getSuperAdminProfile } = require('../controllers/superAdminAuthController');
const { strongPasswordJoi } = require('../utils/passwordPolicy');

const router = express.Router();

// All routes here require Super Admin authentication
router.use(authenticateSuperAdmin, requireSuperAdmin);

router.get('/me', getSuperAdminProfile);
router.get('/schools', listSchools);
router.get('/schools/:id', getSchoolById);

const createSchoolSchema = Joi.object({
  school_name: Joi.string().trim().min(2).max(255).required(),
  type: Joi.string().trim().min(2).max(512).required(),
  institute_number: Joi.string().trim().min(1).max(50).required(),
  admin_name: Joi.string().trim().min(2).max(255).required(),
  admin_email: Joi.string().trim().email().max(255).required(),
  admin_password: strongPasswordJoi().required(),
});

router.post(
  '/schools',
  validate(createSchoolSchema),
  createSchool
);

const updateSchoolSchema = Joi.object({
  school_name: Joi.string().trim().min(2).max(255).optional(),
  institute_number: Joi.string().trim().min(1).max(50).optional(),
  type: Joi.alternatives()
    .try(Joi.string().trim().min(2).max(512), Joi.string().valid(''), Joi.valid(null))
    .optional(),
}).min(1);

router.patch(
  '/schools/:id',
  validate(updateSchoolSchema),
  updateSchoolMetadata
);

const schoolDeleteChallengeSchema = Joi.object({
  password: Joi.string().required(),
});

router.post(
  '/schools/:id/delete-challenge',
  validate(schoolDeleteChallengeSchema),
  requestSchoolDeleteToken
);

const schoolDeleteConfirmSchema = Joi.object({
  password: Joi.string().required(),
  deleteToken: Joi.string().required(),
});

router.delete(
  '/schools/:id',
  validate(schoolDeleteConfirmSchema),
  confirmDeleteSchool
);

const updateSchoolStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'disabled').required(),
});

router.patch(
  '/schools/:id/status',
  validate(updateSchoolStatusSchema),
  updateSchoolStatus
);

router.get('/stats/platform', getPlatformStats);

module.exports = router;

