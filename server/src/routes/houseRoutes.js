const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { getAllHouses, getHouseById } = require('../controllers/houseController');

const router = express.Router();

// Get all houses
router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllHouses);

// Get house by ID
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getHouseById);

module.exports = router;
