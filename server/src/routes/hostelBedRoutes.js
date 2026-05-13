const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  getHostelBeds,
  getHostelBedById,
  createHostelBed,
  updateHostelBed,
  deleteHostelBed,
} = require('../controllers/hostelBedController');

const router = express.Router();

router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getHostelBeds);
router.post('/', requireRole([ROLES.ADMIN, ROLES.ADMINISTRATIVE]), createHostelBed);
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getHostelBedById);
router.put('/:id', requireRole([ROLES.ADMIN, ROLES.ADMINISTRATIVE]), updateHostelBed);
router.delete('/:id', requireRole([ROLES.ADMIN, ROLES.ADMINISTRATIVE]), deleteHostelBed);

module.exports = router;
