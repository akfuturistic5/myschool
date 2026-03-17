const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { getAllCasts, getCastById } = require('../controllers/castController');

const router = express.Router();

// Get all casts
router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllCasts);

// Get cast by ID
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getCastById);

module.exports = router;
