const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { FEE_MANAGER_ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
    getFeesTypes,
    createFeesType,
    updateFeesType,
    deleteFeesType
} = require('../controllers/feesTypeController');

const router = express.Router();

router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getFeesTypes);
router.post('/', requireRole(FEE_MANAGER_ROLES), createFeesType);
router.put('/:id', requireRole(FEE_MANAGER_ROLES), updateFeesType);
router.delete('/:id', requireRole(FEE_MANAGER_ROLES), deleteFeesType);

module.exports = router;
