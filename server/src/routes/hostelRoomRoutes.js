const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  getAllHostelRooms,
  getHostelRoomById,
  createHostelRoom,
  updateHostelRoom,
  deleteHostelRoom,
} = require('../controllers/hostelRoomController');

const router = express.Router();

router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllHostelRooms);
router.post('/', requireRole([ROLES.ADMIN, ROLES.ADMINISTRATIVE]), createHostelRoom);
router.put('/:id', requireRole([ROLES.ADMIN, ROLES.ADMINISTRATIVE]), updateHostelRoom);
router.delete('/:id', requireRole([ROLES.ADMIN, ROLES.ADMINISTRATIVE]), deleteHostelRoom);
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getHostelRoomById);

module.exports = router;
