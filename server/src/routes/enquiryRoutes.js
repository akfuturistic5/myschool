const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { validate } = require('../utils/validate');
const { ROLES } = require('../config/roles');
const { listEnquiries, createEnquiry, updateEnquiry, deleteEnquiry } = require('../controllers/enquiryController');
const { enquiryBodySchema, enquiryQuerySchema, enquiryIdParamSchema } = require('../validations/enquiryValidation');

const router = express.Router();
const ENQUIRY_ACCESS_ROLES = [ROLES.ADMIN, ROLES.ADMINISTRATIVE, ROLES.TEACHER];

router.get('/', requireRole(ENQUIRY_ACCESS_ROLES), validate(enquiryQuerySchema, 'query'), listEnquiries);
router.post('/', requireRole(ENQUIRY_ACCESS_ROLES), validate(enquiryBodySchema), createEnquiry);
router.put('/:id', requireRole(ENQUIRY_ACCESS_ROLES), validate(enquiryIdParamSchema, 'params'), validate(enquiryBodySchema), updateEnquiry);
router.delete('/:id', requireRole(ENQUIRY_ACCESS_ROLES), validate(enquiryIdParamSchema, 'params'), deleteEnquiry);

module.exports = router;
