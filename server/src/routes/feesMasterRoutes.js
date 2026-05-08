const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { FEE_MANAGER_ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
    getFeesMaster,
    createFeesMaster,
    updateFeesMaster,
    deleteFeesMaster,
    bulkDeleteFeesMaster,
    getInstallments,
    createInstallment,
    deleteInstallment
} = require('../controllers/feesMasterController');

const router = express.Router();

// Fee items (fees_class_types)
router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getFeesMaster);
router.post('/', requireRole(FEE_MANAGER_ROLES), createFeesMaster);
router.post('/bulk-delete', requireRole(FEE_MANAGER_ROLES), bulkDeleteFeesMaster);
router.put('/:id', requireRole(FEE_MANAGER_ROLES), updateFeesMaster);
router.delete('/:id', requireRole(FEE_MANAGER_ROLES), deleteFeesMaster);

// Installments for a fee config
router.get('/:fee_id/installments', requireRole(ALL_AUTHENTICATED_ROLES), getInstallments);
router.post('/:fee_id/installments', requireRole(FEE_MANAGER_ROLES), createInstallment);
router.delete('/installments/:id', requireRole(FEE_MANAGER_ROLES), deleteInstallment);

module.exports = router;
