const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { FEE_MANAGER_ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
    collectFees,
    getStudentFeeStatus,
    getPaymentHistory,
    getFeeCollectionsList
} = require('../controllers/feesCollectController');

const router = express.Router();

router.post('/collect', requireRole(FEE_MANAGER_ROLES), collectFees);
router.get('/student/:studentId/:academicYearId', requireRole(ALL_AUTHENTICATED_ROLES), getStudentFeeStatus);
router.get('/history/:studentId/:academicYearId', requireRole(ALL_AUTHENTICATED_ROLES), getPaymentHistory);
router.get('/list', requireRole(FEE_MANAGER_ROLES), getFeeCollectionsList);

module.exports = router;
