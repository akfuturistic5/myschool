const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { getAllBloodGroups, getBloodGroupById } = require('../controllers/bloodGroupController');

const router = express.Router();

// Get all blood groups
router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllBloodGroups);

// Get blood group by ID
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getBloodGroupById);

module.exports = router;
