const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/rbacMiddleware');
const { ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent
} = require('../controllers/calendarController');

router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllEvents);
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getEventById);
router.post('/', requireRole(ALL_AUTHENTICATED_ROLES), createEvent);
router.put('/:id', requireRole(ALL_AUTHENTICATED_ROLES), updateEvent);
router.delete('/:id', requireRole(ALL_AUTHENTICATED_ROLES), deleteEvent);

module.exports = router;
