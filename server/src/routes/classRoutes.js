const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { validate } = require('../utils/validate');
const { ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { classCreateSchema, classUpdateSchema } = require('../validations/classValidation');
const { getAllClasses, getClassById, createClass, updateClass, deleteClass } = require('../controllers/classController');

const router = express.Router();

// Get all classes
router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllClasses);

// Create class
router.post('/', requireRole([ROLES.ADMIN]), validate(classCreateSchema), createClass);

// Get class by ID
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getClassById);

// Update class
router.put('/:id', requireRole([ROLES.ADMIN]), validate(classUpdateSchema), updateClass);
router.delete('/:id', requireRole([ROLES.ADMIN]), deleteClass);

module.exports = router;
