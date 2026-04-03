const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { EVENT_MANAGER_ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  getAllEvents,
  getUpcomingEvents,
  getCompletedEvents,
  createEvent,
  updateEvent,
  deleteEvent,
} = require('../controllers/eventsController');

const router = express.Router();

// All authenticated users can view events
router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllEvents);
router.get('/upcoming', requireRole(ALL_AUTHENTICATED_ROLES), getUpcomingEvents);
router.get('/completed', requireRole(ALL_AUTHENTICATED_ROLES), getCompletedEvents);

// Headmaster + Teacher only - create, update, delete
router.post('/', requireRole(EVENT_MANAGER_ROLES), createEvent);
router.put('/:id', requireRole(EVENT_MANAGER_ROLES), updateEvent);
router.delete('/:id', requireRole(EVENT_MANAGER_ROLES), deleteEvent);

module.exports = router;
