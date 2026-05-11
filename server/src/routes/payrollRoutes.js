const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ADMIN_ROLE_IDS, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  listPayslips,
  generatePayroll,
  updatePayslipStatus,
  getPayslipById,
  deletePayslip,
  bulkDeletePayslips,
  bulkUpdatePayslipStatus,
} = require('../controllers/payrollController');

const router = express.Router();

router.get('/', requireRole(ADMIN_ROLE_IDS), listPayslips);
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getPayslipById); // Allow staff to see their own payslip (need check in controller if self)
router.post('/generate', requireRole(ADMIN_ROLE_IDS), generatePayroll);
router.put('/:id', requireRole(ADMIN_ROLE_IDS), updatePayslipStatus);
router.delete('/:id', requireRole(ADMIN_ROLE_IDS), deletePayslip);
router.post('/bulk-delete', requireRole(ADMIN_ROLE_IDS), bulkDeletePayslips);
router.post('/bulk-status-update', requireRole(ADMIN_ROLE_IDS), bulkUpdatePayslipStatus);

module.exports = router;
