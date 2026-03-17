const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  getAllClassRooms,
  getClassRoomById,
  createClassRoom,
  updateClassRoom,
  deleteClassRoom
} = require('../controllers/classRoomController');

const router = express.Router();

router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllClassRooms);
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getClassRoomById);
router.post('/', requireRole([ROLES.ADMIN]), createClassRoom);
router.put('/:id', requireRole([ROLES.ADMIN]), updateClassRoom);
router.delete('/:id', requireRole([ROLES.ADMIN]), deleteClassRoom);

module.exports = router;
