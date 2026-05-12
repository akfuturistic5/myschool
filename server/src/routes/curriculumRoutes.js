const express = require('express');
const router = express.Router();
const curriculumController = require('../controllers/curriculumController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/electives', curriculumController.getElectiveSubjects);
router.get('/map', curriculumController.getCurriculumMap);
router.post('/assign', curriculumController.assignElectives);

module.exports = router;
