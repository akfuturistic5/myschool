const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ADMIN_ROLE_IDS, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  getAllExamTypes,
  getExamTypeById,
  createExamType,
  updateExamType,
  toggleExamTypeStatus,
  deleteExamType,
} = require('../controllers/examTypeController');

const router = express.Router();

router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllExamTypes);
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getExamTypeById);
router.post('/', requireRole(ADMIN_ROLE_IDS), createExamType);
router.put('/:id', requireRole(ADMIN_ROLE_IDS), updateExamType);
router.patch('/:id/toggle-status', requireRole(ADMIN_ROLE_IDS), toggleExamTypeStatus);
router.delete('/:id', requireRole(ADMIN_ROLE_IDS), deleteExamType);

module.exports = router;
