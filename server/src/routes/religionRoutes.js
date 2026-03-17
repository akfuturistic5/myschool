const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { getAllReligions, getReligionById } = require('../controllers/religionController');

const router = express.Router();

// Get all religions
router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllReligions);

// Get religion by ID
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getReligionById);

module.exports = router;
