const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { getAllRoomTypes, getRoomTypeById } = require('../controllers/roomTypeController');

const router = express.Router();

// Get all room types
router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllRoomTypes);

// Get room type by ID
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getRoomTypeById);

module.exports = router;
