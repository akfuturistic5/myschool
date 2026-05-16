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
  impersonateSchool,
  updateSchoolPlan,
  getSchoolModuleConfig,
  putSchoolModuleOverrides,
} = require('../controllers/superAdminController');
const {
  listPlans,
  createPlan,
  updatePlan,
  getPlanModules,
  putPlanModules,
} = require('../controllers/superAdminPlansController');
const {
  listEnquiries,
  createEnquiry,
  patchEnquiry,
} = require('../controllers/superAdminEnquiriesController');
const { getSuperAdminProfile } = require('../controllers/superAdminAuthController');
const { strongPasswordJoi } = require('../utils/passwordPolicy');

const router = express.Router();

// All routes here require Super Admin authentication
router.use(authenticateSuperAdmin, requireSuperAdmin);

router.get('/me', getSuperAdminProfile);
router.get('/stats/platform', getPlatformStats);

router.get('/plans', listPlans);
const planPricingFields = {
  price_amount: Joi.number().min(0).precision(2).optional(),
  billing_interval: Joi.string()
    .valid('monthly', 'quarterly', 'yearly', 'lifetime', 'one_time')
    .optional(),
  setup_fee: Joi.number().min(0).precision(2).optional(),
  trial_days: Joi.number().integer().min(0).max(3650).optional(),
};

const createPlanSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  slug: Joi.string().trim().min(2).max(80).required(),
  description: Joi.string().allow('', null).max(2000).optional(),
  sort_order: Joi.number().integer().min(0).optional(),
  is_active: Joi.boolean().optional(),
  ...planPricingFields,
});
router.post('/plans', validate(createPlanSchema), createPlan);
const updatePlanSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).optional(),
  description: Joi.string().allow('', null).max(2000).optional(),
  sort_order: Joi.number().integer().min(0).optional(),
  is_active: Joi.boolean().optional(),
  ...planPricingFields,
}).min(1);
router.patch('/plans/:id', validate(updatePlanSchema), updatePlan);
router.get('/plans/:id/modules', getPlanModules);
const putPlanModulesSchema = Joi.object({
  modules: Joi.object().required(),
});
router.put('/plans/:id/modules', validate(putPlanModulesSchema), putPlanModules);

router.get('/enquiries', listEnquiries);
const createEnquirySchema = Joi.object({
  contact_name: Joi.string().trim().min(2).max(255).required(),
  organization_name: Joi.string().allow('', null).max(255).optional(),
  email: Joi.string().allow('', null).email().max(255).optional(),
  phone: Joi.string().allow('', null).max(64).optional(),
  message: Joi.string().allow('', null).max(5000).optional(),
});
router.post('/enquiries', validate(createEnquirySchema), createEnquiry);
const patchEnquirySchema = Joi.object({
  status: Joi.string().valid('new', 'contacted', 'converted', 'dismissed').required(),
});
router.patch('/enquiries/:id', validate(patchEnquirySchema), patchEnquiry);

router.get('/schools', listSchools);
router.post('/schools/:id/impersonate', impersonateSchool);
const updateSchoolPlanSchema = Joi.object({
  plan_id: Joi.alternatives().try(Joi.number().integer().positive(), Joi.valid(null)).required(),
});
router.patch('/schools/:id/plan', validate(updateSchoolPlanSchema), updateSchoolPlan);
router.get('/schools/:id/modules', getSchoolModuleConfig);
const putSchoolOverridesSchema = Joi.object({
  overrides: Joi.array()
    .items(
      Joi.object({
        module_key: Joi.string().trim().min(1).max(64).required(),
        show_in_menu: Joi.boolean().required(),
        route_accessible: Joi.boolean().required(),
      })
    )
    .required(),
});
router.put('/schools/:id/modules/overrides', validate(putSchoolOverridesSchema), putSchoolModuleOverrides);
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

module.exports = router;

