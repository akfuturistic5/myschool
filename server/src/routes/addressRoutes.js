const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/rbacMiddleware');
const { ROLES } = require('../config/roles');
const {
  createAddress,
  updateAddress,
  getAllAddresses,
  getAddressById,
  getAddressesByUserId,
  deleteAddress
} = require('../controllers/addressController');
const { validate } = require('../utils/validate');
const { createAddressSchema, updateAddressSchema } = require('../validations/addressValidation');

const ALL_AUTHENTICATED_ROLES = [
  ROLES.ADMIN,
  ROLES.STUDENT,
  ROLES.TEACHER,
  ROLES.PARENT,
  ROLES.GUARDIAN,
];

// Create new address - restricted to authenticated roles; controller enforces ownership/Admin override
router.post('/', requireRole(ALL_AUTHENTICATED_ROLES), validate(createAddressSchema), createAddress);

// Get all addresses - Admin only
router.get('/', requireRole([ROLES.ADMIN]), getAllAddresses);

// Get address by ID - authenticated roles, controller enforces ownership/Admin override
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getAddressById);

// Get addresses by user ID - authenticated roles, controller enforces ownership/Admin override
router.get('/user/:userId', requireRole(ALL_AUTHENTICATED_ROLES), getAddressesByUserId);

// Update address - authenticated roles, controller enforces ownership/Admin override
router.put('/:id', requireRole(ALL_AUTHENTICATED_ROLES), validate(updateAddressSchema), updateAddress);

// Delete address - authenticated roles, controller enforces ownership/Admin override
router.delete('/:id', requireRole(ALL_AUTHENTICATED_ROLES), deleteAddress);

module.exports = router;
