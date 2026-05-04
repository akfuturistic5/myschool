const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ADMIN_ROLE_IDS, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  getAllHouses,
  getHouseById,
  createHouse,
  updateHouse,
  toggleHouseStatus,
  deleteHouse,
} = require('../controllers/houseController');

const router = express.Router();

router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllHouses);
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getHouseById);
router.post('/', requireRole(ADMIN_ROLE_IDS), createHouse);
router.put('/:id', requireRole(ADMIN_ROLE_IDS), updateHouse);
router.patch('/:id/toggle-status', requireRole(ADMIN_ROLE_IDS), toggleHouseStatus);
router.delete('/:id', requireRole(ADMIN_ROLE_IDS), deleteHouse);

module.exports = router;
