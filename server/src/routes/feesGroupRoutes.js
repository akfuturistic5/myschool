const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { FEE_MANAGER_ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
    getFeesGroups,
    createFeesGroup,
    updateFeesGroup,
    deleteFeesGroup
} = require('../controllers/feesGroupController');

const router = express.Router();

router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getFeesGroups);
router.post('/', requireRole(FEE_MANAGER_ROLES), createFeesGroup);
router.put('/:id', requireRole(FEE_MANAGER_ROLES), updateFeesGroup);
router.delete('/:id', requireRole(FEE_MANAGER_ROLES), deleteFeesGroup);

module.exports = router;
