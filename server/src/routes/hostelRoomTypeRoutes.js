const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  getAllHostelRoomTypes,
  getHostelRoomTypeById,
  createHostelRoomType,
  updateHostelRoomType,
  deleteHostelRoomType,
} = require('../controllers/hostelRoomTypeController');

const router = express.Router();

router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllHostelRoomTypes);
router.post('/', requireRole([ROLES.ADMIN, ROLES.ADMINISTRATIVE]), createHostelRoomType);
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getHostelRoomTypeById);
router.put('/:id', requireRole([ROLES.ADMIN, ROLES.ADMINISTRATIVE]), updateHostelRoomType);
router.delete('/:id', requireRole([ROLES.ADMIN, ROLES.ADMINISTRATIVE]), deleteHostelRoomType);

module.exports = router;
