const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/rbacMiddleware');
const { ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  getAllNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote
} = require('../controllers/notesController');

router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllNotes);
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getNoteById);
router.post('/', requireRole(ALL_AUTHENTICATED_ROLES), createNote);
router.put('/:id', requireRole(ALL_AUTHENTICATED_ROLES), updateNote);
router.delete('/:id', requireRole(ALL_AUTHENTICATED_ROLES), deleteNote);

module.exports = router;
