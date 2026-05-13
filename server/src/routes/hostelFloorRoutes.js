const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  getHostelFloorsByHostel,
  getHostelFloorById,
  createHostelFloor,
  updateHostelFloor,
  deleteHostelFloor,
} = require('../controllers/hostelFloorController');

const router = express.Router();

router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getHostelFloorsByHostel);
router.post('/', requireRole([ROLES.ADMIN, ROLES.ADMINISTRATIVE]), createHostelFloor);
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getHostelFloorById);
router.put('/:id', requireRole([ROLES.ADMIN, ROLES.ADMINISTRATIVE]), updateHostelFloor);
router.delete('/:id', requireRole([ROLES.ADMIN, ROLES.ADMINISTRATIVE]), deleteHostelFloor);

module.exports = router;
