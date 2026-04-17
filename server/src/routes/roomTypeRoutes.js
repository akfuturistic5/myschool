const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  getAllRoomTypes,
  getRoomTypeById,
  createRoomType,
  updateRoomType,
  deleteRoomType,
} = require('../controllers/roomTypeController');

const router = express.Router();

router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllRoomTypes);
router.post('/', requireRole([ROLES.ADMIN, ROLES.ADMINISTRATIVE]), createRoomType);
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getRoomTypeById);
router.put('/:id', requireRole([ROLES.ADMIN, ROLES.ADMINISTRATIVE]), updateRoomType);
router.delete('/:id', requireRole([ROLES.ADMIN, ROLES.ADMINISTRATIVE]), deleteRoomType);

module.exports = router;
