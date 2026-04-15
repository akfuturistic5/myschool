const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ADMIN_ROLE_IDS, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  getAllReligions,
  getReligionById,
  createReligion,
  updateReligion,
  toggleReligionStatus,
  deleteReligion,
} = require('../controllers/religionController');

const router = express.Router();

// Get all religions
router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllReligions);

// Get religion by ID
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getReligionById);
router.post('/', requireRole(ADMIN_ROLE_IDS), createReligion);
router.put('/:id', requireRole(ADMIN_ROLE_IDS), updateReligion);
router.patch('/:id/toggle-status', requireRole(ADMIN_ROLE_IDS), toggleReligionStatus);
router.delete('/:id', requireRole(ADMIN_ROLE_IDS), deleteReligion);

module.exports = router;
