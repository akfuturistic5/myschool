const express = require('express');
const { protectApi } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/rbacMiddleware');
const { validate } = require('../utils/validate');
const { createLeaveApplicationSchema, updateLeaveStatusSchema } = require('../validations/leaveValidation');
const { LEAVE_APPROVER_ROLES, LEAVE_LIST_ALL_ROLES } = require('../config/roles');
const {
  getLeaveTypes,
  createLeaveApplication,
  updateLeaveApplicationStatus,
  getLeaveApplications,
  getMyLeaveApplications,
  getParentChildrenLeaves,
  getGuardianWardLeaves,
} = require('../controllers/leaveApplicationController');

const router = express.Router();

// GET /api/leave-applications/leave-types - all leave types (public for dropdown)
router.get('/leave-types', getLeaveTypes);

// POST /api/leave-applications - create leave (requires auth)
router.post('/', protectApi, validate(createLeaveApplicationSchema), createLeaveApplication);

// PUT /api/leave-applications/:id - update status (approve/reject) - Admin/HR only
router.put('/:id', protectApi, requireRole(LEAVE_APPROVER_ROLES), validate(updateLeaveStatusSchema, 'body'), updateLeaveApplicationStatus);

// GET /api/leave-applications/me - current student's or staff's leaves
router.get('/me', protectApi, getMyLeaveApplications);
// GET /api/leave-applications/parent-children - parent's children leaves (for Parent Dashboard)
router.get('/parent-children', protectApi, getParentChildrenLeaves);
// GET /api/leave-applications/guardian-wards - guardian's ward leaves (for Guardian Dashboard)
router.get('/guardian-wards', protectApi, getGuardianWardLeaves);
// GET /api/leave-applications - all/filtered list (Admin only)
router.get('/', protectApi, requireRole(LEAVE_LIST_ALL_ROLES), getLeaveApplications);

module.exports = router;
