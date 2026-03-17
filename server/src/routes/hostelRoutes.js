const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { getAllHostels, getHostelById } = require('../controllers/hostelController');

const router = express.Router();

// Get all hostels
router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllHostels);

// Get hostel by ID
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getHostelById);

module.exports = router;
