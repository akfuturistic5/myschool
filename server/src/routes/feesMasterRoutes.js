const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { FEE_MANAGER_ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
    getFeesMaster,
    createFeesMaster,
    updateFeesMaster,
    deleteFeesMaster
} = require('../controllers/feesMasterController');

const router = express.Router();

router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getFeesMaster);
router.post('/', requireRole(FEE_MANAGER_ROLES), createFeesMaster);
router.put('/:id', requireRole(FEE_MANAGER_ROLES), updateFeesMaster);
router.delete('/:id', requireRole(FEE_MANAGER_ROLES), deleteFeesMaster);

module.exports = router;
