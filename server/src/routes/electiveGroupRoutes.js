const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ALL_AUTHENTICATED_ROLES, ADMIN_ROLE_IDS } = require('../config/roles');
const { 
  getAllGroups, 
  createGroup, 
  updateGroup, 
  deleteGroup 
} = require('../controllers/electiveGroupController');
const { validate } = require('../utils/validate');
const { electiveGroupSchema } = require('../validations/classSubjectValidation');

const router = express.Router();

router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllGroups);
router.post('/', requireRole(ADMIN_ROLE_IDS), validate(electiveGroupSchema), createGroup);
router.put('/:id', requireRole(ADMIN_ROLE_IDS), validate(electiveGroupSchema), updateGroup);
router.delete('/:id', requireRole(ADMIN_ROLE_IDS), deleteGroup);

module.exports = router;
