const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ADMIN_ROLE_IDS, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  getAllBloodGroups,
  getBloodGroupById,
  createBloodGroup,
  updateBloodGroup,
  toggleBloodGroupStatus,
  deleteBloodGroup,
} = require('../controllers/bloodGroupController');

const router = express.Router();

router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllBloodGroups);
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getBloodGroupById);
router.post('/', requireRole(ADMIN_ROLE_IDS), createBloodGroup);
router.put('/:id', requireRole(ADMIN_ROLE_IDS), updateBloodGroup);
router.patch('/:id/toggle-status', requireRole(ADMIN_ROLE_IDS), toggleBloodGroupStatus);
router.delete('/:id', requireRole(ADMIN_ROLE_IDS), deleteBloodGroup);

module.exports = router;
