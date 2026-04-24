const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { EXAM_LIST_ROLES, EXAM_ADMIN_ROLES, ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  getGradeScale,
  createGradeScale,
  updateGradeScale,
  deleteGradeScale,
  getExamSubjectsContext,
  saveExamSubjectSetup,
  getExamMarksContext,
  saveExamMarks,
  viewExamSchedule,
  viewExamResults,
  viewExamTopPerformers,
  listSelfExamOptions,
} = require('../controllers/examModuleController');

const router = express.Router();

router.get('/grade-scale', requireRole(EXAM_LIST_ROLES), getGradeScale);
router.post('/grade-scale', requireRole(EXAM_ADMIN_ROLES), createGradeScale);
router.put('/grade-scale/:id', requireRole(EXAM_ADMIN_ROLES), updateGradeScale);
router.delete('/grade-scale/:id', requireRole(EXAM_ADMIN_ROLES), deleteGradeScale);
router.get('/context', requireRole(EXAM_LIST_ROLES), getExamSubjectsContext);
router.post('/save', requireRole([ROLES.TEACHER]), saveExamSubjectSetup);
router.get('/marks-context', requireRole([ROLES.TEACHER]), getExamMarksContext);
router.post('/marks-save', requireRole([ROLES.TEACHER]), saveExamMarks);
router.get('/schedule', requireRole(ALL_AUTHENTICATED_ROLES), viewExamSchedule);
router.get('/results', requireRole(ALL_AUTHENTICATED_ROLES), viewExamResults);
router.get('/top-performers', requireRole(ALL_AUTHENTICATED_ROLES), viewExamTopPerformers);
router.get('/self-exams', requireRole(ALL_AUTHENTICATED_ROLES), listSelfExamOptions);

module.exports = router;

