const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { EXAM_LIST_ROLES, ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  getExamSubjectsContext,
  saveExamSubjectSetup,
  getExamMarksContext,
  saveExamMarks,
  viewExamSchedule,
  viewExamResults,
  listSelfExamOptions,
} = require('../controllers/examModuleController');

const router = express.Router();

router.get('/context', requireRole(EXAM_LIST_ROLES), getExamSubjectsContext);
router.post('/save', requireRole([ROLES.TEACHER]), saveExamSubjectSetup);
router.get('/marks-context', requireRole([ROLES.TEACHER]), getExamMarksContext);
router.post('/marks-save', requireRole([ROLES.TEACHER]), saveExamMarks);
router.get('/schedule', requireRole(ALL_AUTHENTICATED_ROLES), viewExamSchedule);
router.get('/results', requireRole(ALL_AUTHENTICATED_ROLES), viewExamResults);
router.get('/self-exams', requireRole(ALL_AUTHENTICATED_ROLES), listSelfExamOptions);

module.exports = router;

