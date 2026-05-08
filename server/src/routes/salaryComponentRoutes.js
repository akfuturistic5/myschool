const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ADMIN_ROLE_IDS } = require('../config/roles');
const {
  getAllComponents,
  createComponent,
  updateComponent,
  deleteComponent,
} = require('../controllers/salaryComponentController');

const router = express.Router();

// Only Admins or People Managers should manage salary components
router.get('/', getAllComponents);
router.post('/', requireRole(ADMIN_ROLE_IDS), createComponent);
router.put('/:id', requireRole(ADMIN_ROLE_IDS), updateComponent);
router.delete('/:id', requireRole(ADMIN_ROLE_IDS), deleteComponent);

module.exports = router;
