const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { validate } = require('../utils/validate');
const { ROLES } = require('../config/roles');
const {
  listEnquiries,
  createEnquiry,
  updateEnquiry,
  updateEnquiryStatus,
  deleteEnquiry,
  listFollowUpCounselorOptions,
  listFollowUpsByEnquiry,
  listFollowUpActivity,
  createFollowUpForEnquiry,
} = require('../controllers/enquiryController');
const {
  enquiryBodySchema,
  enquiryQuerySchema,
  enquiryIdParamSchema,
  followUpBodySchema,
  followUpActivityQuerySchema,
  enquiryStatusBodySchema,
} = require('../validations/enquiryValidation');

const router = express.Router();
const ENQUIRY_ACCESS_ROLES = [ROLES.ADMIN, ROLES.ADMINISTRATIVE, ROLES.TEACHER];

router.get(
  '/follow-up/counselors',
  requireRole(ENQUIRY_ACCESS_ROLES),
  listFollowUpCounselorOptions
);
router.get(
  '/follow-up/activity',
  requireRole(ENQUIRY_ACCESS_ROLES),
  validate(followUpActivityQuerySchema, 'query'),
  listFollowUpActivity
);
router.get('/', requireRole(ENQUIRY_ACCESS_ROLES), validate(enquiryQuerySchema, 'query'), listEnquiries);
router.post('/', requireRole(ENQUIRY_ACCESS_ROLES), validate(enquiryBodySchema), createEnquiry);
router.get(
  '/:id/follow-ups',
  requireRole(ENQUIRY_ACCESS_ROLES),
  validate(enquiryIdParamSchema, 'params'),
  listFollowUpsByEnquiry
);
router.post(
  '/:id/follow-ups',
  requireRole(ENQUIRY_ACCESS_ROLES),
  validate(enquiryIdParamSchema, 'params'),
  validate(followUpBodySchema),
  createFollowUpForEnquiry
);
router.patch(
  '/:id/status',
  requireRole(ENQUIRY_ACCESS_ROLES),
  validate(enquiryIdParamSchema, 'params'),
  validate(enquiryStatusBodySchema),
  updateEnquiryStatus
);
router.put('/:id', requireRole(ENQUIRY_ACCESS_ROLES), validate(enquiryIdParamSchema, 'params'), validate(enquiryBodySchema), updateEnquiry);
router.delete('/:id', requireRole(ENQUIRY_ACCESS_ROLES), validate(enquiryIdParamSchema, 'params'), deleteEnquiry);

module.exports = router;
