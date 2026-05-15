const express = require('express');
const { protectApi } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/rbacMiddleware');
const { validate } = require('../utils/validate');
const {
  createLeaveApplicationSchema,
  updateLeaveStatusSchema,
  cancelLeaveSchema,
  createLeaveTypeSchema,
  updateLeaveTypeSchema,
} = require('../validations/leaveValidation');
const {
  LEAVE_APPROVER_ROLES,
  LEAVE_LIST_ALL_ROLES,
  ALL_AUTHENTICATED_ROLES,
  ADMIN_DASHBOARD_ROLES,
} = require('../config/roles');
const {
  getLeaveTypes,
  getLeaveTypesAdmin,
  createLeaveType,
  updateLeaveType,
  deleteLeaveType,
  createLeaveApplication,
  updateLeaveApplicationStatus,
  cancelLeaveApplication,
  getLeaveApplications,
  getMyLeaveApplications,
  getParentChildrenLeaves,
  getGuardianWardLeaves,
} = require('../controllers/leaveApplicationController');

const router = express.Router();

// GET /api/leave-applications/leave-types - all leave types (public for dropdown)
router.get('/leave-types', requireRole(ALL_AUTHENTICATED_ROLES), getLeaveTypes);
router.get('/leave-types/admin', protectApi, requireRole(ADMIN_DASHBOARD_ROLES), getLeaveTypesAdmin);
router.post('/leave-types', protectApi, requireRole(ADMIN_DASHBOARD_ROLES), validate(createLeaveTypeSchema), createLeaveType);
router.put('/leave-types/:id', protectApi, requireRole(ADMIN_DASHBOARD_ROLES), validate(updateLeaveTypeSchema, 'body'), updateLeaveType);
router.delete('/leave-types/:id', protectApi, requireRole(ADMIN_DASHBOARD_ROLES), deleteLeaveType);

// POST /api/leave-applications - create leave (requires auth)
router.post('/', protectApi, requireRole(ALL_AUTHENTICATED_ROLES), validate(createLeaveApplicationSchema), createLeaveApplication);

// PUT /api/leave-applications/:id - update status (approve/reject) - Admin/HR only
router.put('/:id', protectApi, requireRole(LEAVE_APPROVER_ROLES), validate(updateLeaveStatusSchema, 'body'), updateLeaveApplicationStatus);
// POST /api/leave-applications/:id/cancel - applicant can cancel their own pending leave
router.post('/:id/cancel', protectApi, requireRole(ALL_AUTHENTICATED_ROLES), validate(cancelLeaveSchema, 'body'), cancelLeaveApplication);

// GET /api/leave-applications/me - current student's or staff's leaves
router.get('/me', protectApi, requireRole(ALL_AUTHENTICATED_ROLES), getMyLeaveApplications);
// GET /api/leave-applications/parent-children - parent's children leaves (for Parent Dashboard)
router.get('/parent-children', protectApi, requireRole(ALL_AUTHENTICATED_ROLES), getParentChildrenLeaves);
// GET /api/leave-applications/guardian-wards - guardian's ward leaves (for Guardian Dashboard)
router.get('/guardian-wards', protectApi, requireRole(ALL_AUTHENTICATED_ROLES), getGuardianWardLeaves);
// GET /api/leave-applications - all/filtered list (Admin only)
router.get('/', protectApi, requireRole(LEAVE_LIST_ALL_ROLES), getLeaveApplications);

module.exports = router;
