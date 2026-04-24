const express = require('express');
const multer = require('multer');
const { requireRole } = require('../middleware/rbacMiddleware');
const { EVENT_MANAGER_ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { upload } = require('../middleware/schoolStorageUpload');
const { error: errorResponse } = require('../utils/responseHelper');
const {
  getAllEvents,
  getUpcomingEvents,
  getCompletedEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventAttachments,
  uploadEventAttachment,
  deleteEventAttachment,
} = require('../controllers/eventsController');

const router = express.Router();

function uploadWithErrorHandling(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return errorResponse(res, 400, err.message);
    }
    if (err) {
      return errorResponse(res, 400, err.message || 'Upload rejected');
    }
    next();
  });
}

// All authenticated users can view events
router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllEvents);
router.get('/upcoming', requireRole(ALL_AUTHENTICATED_ROLES), getUpcomingEvents);
router.get('/completed', requireRole(ALL_AUTHENTICATED_ROLES), getCompletedEvents);

// Headmaster + Administrative only - create, update, delete
router.post('/', requireRole(EVENT_MANAGER_ROLES), createEvent);
router.put('/:id', requireRole(EVENT_MANAGER_ROLES), updateEvent);
router.delete('/:id', requireRole(EVENT_MANAGER_ROLES), deleteEvent);

// Event attachment metadata + file storage (school-scoped)
router.get('/:id/attachments', requireRole(ALL_AUTHENTICATED_ROLES), getEventAttachments);
router.post('/:id/attachments', requireRole(EVENT_MANAGER_ROLES), uploadWithErrorHandling, uploadEventAttachment);
router.delete('/:id/attachments/:attachmentId', requireRole(EVENT_MANAGER_ROLES), deleteEventAttachment);

module.exports = router;
