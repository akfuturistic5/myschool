const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { validate } = require('../utils/validate');
const { ALL_AUTHENTICATED_ROLES, PEOPLE_MANAGER_ROLES } = require('../config/roles');
const {
  getAllAcademicYears,
  getAllAcademicYearsManage,
  getAcademicYearById,
  getAcademicYearSummary,
  createAcademicYear,
  updateAcademicYear,
} = require('../controllers/academicYearController');
const {
  createAcademicYearSchema,
  updateAcademicYearSchema,
} = require('../validations/academicYearValidation');

const router = express.Router();

// Specific paths before /:id
router.get('/manage', requireRole(PEOPLE_MANAGER_ROLES), getAllAcademicYearsManage);
router.get('/:id/summary', requireRole(PEOPLE_MANAGER_ROLES), getAcademicYearSummary);

router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllAcademicYears);
router.post('/', requireRole(PEOPLE_MANAGER_ROLES), validate(createAcademicYearSchema), createAcademicYear);
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getAcademicYearById);
router.patch('/:id', requireRole(PEOPLE_MANAGER_ROLES), validate(updateAcademicYearSchema), updateAcademicYear);

module.exports = router;
