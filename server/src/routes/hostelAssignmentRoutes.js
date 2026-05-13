const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  getHostelAssignments,
  getHostelAssignmentById,
  createHostelAssignment,
  updateHostelAssignment,
  checkoutHostelAssignment,
  cancelHostelAssignment,
} = require('../controllers/hostelAssignmentController');

const router = express.Router();

router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getHostelAssignments);
router.post('/', requireRole([ROLES.ADMIN, ROLES.ADMINISTRATIVE]), createHostelAssignment);
router.patch('/:id/checkout', requireRole([ROLES.ADMIN, ROLES.ADMINISTRATIVE]), checkoutHostelAssignment);
router.patch('/:id/cancel', requireRole([ROLES.ADMIN, ROLES.ADMINISTRATIVE]), cancelHostelAssignment);
router.patch('/:id', requireRole([ROLES.ADMIN, ROLES.ADMINISTRATIVE]), updateHostelAssignment);
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getHostelAssignmentById);

module.exports = router;
