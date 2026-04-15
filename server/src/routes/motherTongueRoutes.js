const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { getAllMotherTongues, getMotherTongueById } = require('../controllers/motherTongueController');

const router = express.Router();

// Get all mother tongues
router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllMotherTongues);

// Get mother tongue by ID
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getMotherTongueById);

module.exports = router;
