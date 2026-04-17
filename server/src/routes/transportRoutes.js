const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { getAllRoutes, getRouteById, createRoute, updateRoute, deleteRoute } = require('../controllers/transportRouteController');
const { getAllPickupPoints, createPickupPoint, getPickupPointById, updatePickupPoint, deletePickupPoint } = require('../controllers/transportPickupController');
const { getAllVehicles, getVehicleById, createVehicle, updateVehicle, deleteVehicle } = require('../controllers/transportVehicleController');
const { getAllDrivers, getDriverById, createDriver, updateDriver, deleteDriver } = require('../controllers/transportDriverController');
const { getAllAssignments, createAssignment, updateAssignment, deleteAssignment } = require('../controllers/transportAssignmentController');

const router = express.Router();

// Transport routes (route names)
router.get('/routes', requireRole(ALL_AUTHENTICATED_ROLES), getAllRoutes);
router.post('/routes', requireRole([ROLES.ADMIN]), createRoute);
router.put('/routes/:id', requireRole([ROLES.ADMIN]), updateRoute);
router.get('/routes/:id', requireRole(ALL_AUTHENTICATED_ROLES), getRouteById);
router.delete('/routes/:id', requireRole([ROLES.ADMIN]), deleteRoute);

// Pickup points
router.get('/pickup-points', requireRole(ALL_AUTHENTICATED_ROLES), getAllPickupPoints);
router.post('/pickup-points', requireRole([ROLES.ADMIN]), createPickupPoint);
router.put('/pickup-points/:id', requireRole([ROLES.ADMIN]), updatePickupPoint);
router.get('/pickup-points/:id', requireRole(ALL_AUTHENTICATED_ROLES), getPickupPointById);
router.delete('/pickup-points/:id', requireRole([ROLES.ADMIN]), deletePickupPoint);

// Vehicles (driver_id = assignment to driver)
router.get('/vehicles', requireRole(ALL_AUTHENTICATED_ROLES), getAllVehicles);
router.post('/vehicles', requireRole([ROLES.ADMIN]), createVehicle);
router.get('/vehicles/:id', requireRole(ALL_AUTHENTICATED_ROLES), getVehicleById);
router.put('/vehicles/:id', requireRole([ROLES.ADMIN]), updateVehicle);
router.delete('/vehicles/:id', requireRole([ROLES.ADMIN]), deleteVehicle);

// Drivers
router.get('/drivers', requireRole(ALL_AUTHENTICATED_ROLES), getAllDrivers);
router.post('/drivers', requireRole([ROLES.ADMIN]), createDriver);
router.get('/drivers/:id', requireRole(ALL_AUTHENTICATED_ROLES), getDriverById);
router.put('/drivers/:id', requireRole([ROLES.ADMIN]), updateDriver);
router.delete('/drivers/:id', requireRole([ROLES.ADMIN]), deleteDriver);

// Assignments (supports multiple route-driver mapping per vehicle)
router.get('/assignments', requireRole(ALL_AUTHENTICATED_ROLES), getAllAssignments);
router.post('/assignments', requireRole([ROLES.ADMIN]), createAssignment);
router.put('/assignments/:id', requireRole([ROLES.ADMIN]), updateAssignment);
router.delete('/assignments/:id', requireRole([ROLES.ADMIN]), deleteAssignment);

module.exports = router;
