const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { validate } = require('../utils/validate');
const { ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { holidayBodySchema, holidayQuerySchema, holidayIdParamSchema } = require('../validations/holidayValidation');
const {
  createHoliday,
  listHolidays,
  getHolidayById,
  updateHoliday,
  deleteHoliday,
} = require('../controllers/holidayController');

const router = express.Router();
const HOLIDAY_MANAGERS = [ROLES.ADMIN, ROLES.ADMINISTRATIVE];

router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), validate(holidayQuerySchema, 'query'), listHolidays);
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), validate(holidayIdParamSchema, 'params'), getHolidayById);
router.post('/', requireRole(HOLIDAY_MANAGERS), validate(holidayBodySchema), createHoliday);
router.put('/:id', requireRole(HOLIDAY_MANAGERS), validate(holidayIdParamSchema, 'params'), validate(holidayBodySchema), updateHoliday);
router.delete('/:id', requireRole(HOLIDAY_MANAGERS), validate(holidayIdParamSchema, 'params'), deleteHoliday);

module.exports = router;
