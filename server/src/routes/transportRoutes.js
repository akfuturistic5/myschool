const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { getAllRoutes, getRouteById, updateRoute } = require('../controllers/transportRouteController');
const { getAllPickupPoints, getPickupPointById, updatePickupPoint } = require('../controllers/transportPickupController');
const { getAllVehicles, getVehicleById, updateVehicle } = require('../controllers/transportVehicleController');
const { getAllDrivers, getDriverById, updateDriver } = require('../controllers/transportDriverController');

const router = express.Router();

// Transport routes (route names)
router.get('/routes', requireRole(ALL_AUTHENTICATED_ROLES), getAllRoutes);
router.put('/routes/:id', requireRole([ROLES.ADMIN]), updateRoute);
router.get('/routes/:id', requireRole(ALL_AUTHENTICATED_ROLES), getRouteById);

// Pickup points
router.get('/pickup-points', requireRole(ALL_AUTHENTICATED_ROLES), getAllPickupPoints);
router.put('/pickup-points/:id', requireRole([ROLES.ADMIN]), updatePickupPoint);
router.get('/pickup-points/:id', requireRole(ALL_AUTHENTICATED_ROLES), getPickupPointById);

// Vehicles (driver_id = assignment to driver)
router.get('/vehicles', requireRole(ALL_AUTHENTICATED_ROLES), getAllVehicles);
router.put('/vehicles/:id', requireRole([ROLES.ADMIN]), updateVehicle);
router.get('/vehicles/:id', requireRole(ALL_AUTHENTICATED_ROLES), getVehicleById);

// Drivers
router.get('/drivers', requireRole(ALL_AUTHENTICATED_ROLES), getAllDrivers);
router.put('/drivers/:id', requireRole([ROLES.ADMIN]), updateDriver);
router.get('/drivers/:id', requireRole(ALL_AUTHENTICATED_ROLES), getDriverById);

module.exports = router;
