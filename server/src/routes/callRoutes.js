const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/rbacMiddleware');
const { ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  getAllCalls,
  getCallById,
  createCall,
  updateCall,
  deleteCall
} = require('../controllers/callController');

router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllCalls);
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getCallById);
router.post('/', requireRole(ALL_AUTHENTICATED_ROLES), createCall);
router.put('/:id', requireRole(ALL_AUTHENTICATED_ROLES), updateCall);
router.delete('/:id', requireRole(ALL_AUTHENTICATED_ROLES), deleteCall);

module.exports = router;
