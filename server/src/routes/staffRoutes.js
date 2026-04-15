const express = require('express');
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
} = require('../controllers/staffController');

const router = express.Router();

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

module.exports = router;
