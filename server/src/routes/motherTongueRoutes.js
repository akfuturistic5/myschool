const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ADMIN_ROLE_IDS, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  getAllMotherTongues,
  getMotherTongueById,
  createMotherTongue,
  updateMotherTongue,
  toggleMotherTongueStatus,
  deleteMotherTongue,
} = require('../controllers/motherTongueController');

const router = express.Router();

router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllMotherTongues);
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getMotherTongueById);
router.post('/', requireRole(ADMIN_ROLE_IDS), createMotherTongue);
router.put('/:id', requireRole(ADMIN_ROLE_IDS), updateMotherTongue);
router.patch('/:id/toggle-status', requireRole(ADMIN_ROLE_IDS), toggleMotherTongueStatus);
router.delete('/:id', requireRole(ADMIN_ROLE_IDS), deleteMotherTongue);

module.exports = router;
