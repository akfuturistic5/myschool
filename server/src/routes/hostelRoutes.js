const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  getAllHostels,
  getHostelById,
  createHostel,
  updateHostel,
  deleteHostel,
} = require('../controllers/hostelController');

const router = express.Router();

router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllHostels);
router.post('/', requireRole([ROLES.ADMIN, ROLES.ADMINISTRATIVE]), createHostel);
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getHostelById);
router.put('/:id', requireRole([ROLES.ADMIN, ROLES.ADMINISTRATIVE]), updateHostel);
router.delete('/:id', requireRole([ROLES.ADMIN, ROLES.ADMINISTRATIVE]), deleteHostel);

module.exports = router;
