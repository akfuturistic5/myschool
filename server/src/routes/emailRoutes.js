const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/rbacMiddleware');
const { ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  getAllEmails,
  getEmailById,
  createEmail,
  updateEmail,
  deleteEmail
} = require('../controllers/emailController');

router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllEmails);
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getEmailById);
router.post('/', requireRole(ALL_AUTHENTICATED_ROLES), createEmail);
router.put('/:id', requireRole(ALL_AUTHENTICATED_ROLES), updateEmail);
router.delete('/:id', requireRole(ALL_AUTHENTICATED_ROLES), deleteEmail);

module.exports = router;
