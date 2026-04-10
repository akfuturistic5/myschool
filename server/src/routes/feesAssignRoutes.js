const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { FEE_MANAGER_ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
    assignFees,
    getFeesAssignments,
    deleteFeesAssignment
} = require('../controllers/feesAssignController');

const router = express.Router();

router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getFeesAssignments);
router.post('/assign', requireRole(FEE_MANAGER_ROLES), assignFees);
router.delete('/:id', requireRole(FEE_MANAGER_ROLES), deleteFeesAssignment);

module.exports = router;
