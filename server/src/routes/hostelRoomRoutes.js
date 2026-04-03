const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { getAllHostelRooms, getHostelRoomById, updateHostelRoom } = require('../controllers/hostelRoomController');

const router = express.Router();

// Get all hostel rooms
router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllHostelRooms);

// Update hostel room
router.put('/:id', requireRole([ROLES.ADMIN]), updateHostelRoom);

// Get hostel room by ID
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getHostelRoomById);

module.exports = router;
