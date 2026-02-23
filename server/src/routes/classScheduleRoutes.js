const express = require('express');
const { validate } = require('../utils/validate');
const { createClassScheduleSchema } = require('../validations/classScheduleValidation');
const { getAllClassSchedules, getClassScheduleById, createClassSchedule, getClassSchedulesDebug } = require('../controllers/classScheduleController');

const router = express.Router();

router.post('/', validate(createClassScheduleSchema), createClassSchedule);
router.get('/', getAllClassSchedules);
router.get('/debug', getClassSchedulesDebug);
router.get('/:id', getClassScheduleById);

module.exports = router;
