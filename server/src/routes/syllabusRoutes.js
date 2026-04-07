const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { validate } = require('../utils/validate');
const { ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { syllabusCreateSchema, syllabusUpdateSchema } = require('../validations/syllabusValidation');
const {
  getAllSyllabus,
  getSyllabusById,
  createSyllabus,
  updateSyllabus,
  deleteSyllabus
} = require('../controllers/syllabusController');

const router = express.Router();

router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllSyllabus);
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getSyllabusById);
router.post('/', requireRole([ROLES.ADMIN]), validate(syllabusCreateSchema), createSyllabus);
router.put('/:id', requireRole([ROLES.ADMIN]), validate(syllabusUpdateSchema), updateSyllabus);
router.delete('/:id', requireRole([ROLES.ADMIN]), deleteSyllabus);

module.exports = router;
