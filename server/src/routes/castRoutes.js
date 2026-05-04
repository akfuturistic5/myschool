const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ADMIN_ROLE_IDS, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  getAllCasts,
  getCastById,
  createCast,
  updateCast,
  toggleCastStatus,
  deleteCast,
} = require('../controllers/castController');

const router = express.Router();

router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllCasts);
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getCastById);
router.post('/', requireRole(ADMIN_ROLE_IDS), createCast);
router.put('/:id', requireRole(ADMIN_ROLE_IDS), updateCast);
router.patch('/:id/toggle-status', requireRole(ADMIN_ROLE_IDS), toggleCastStatus);
router.delete('/:id', requireRole(ADMIN_ROLE_IDS), deleteCast);

module.exports = router;
