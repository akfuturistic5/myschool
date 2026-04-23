const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { EXAM_ADMIN_ROLES, EXAM_LIST_ROLES } = require('../config/roles');
const { ROLES } = require('../config/roles');
const {
  listExams,
  createExam,
  deleteExam,
  getManageContext,
  listExamSubjects,
  listExamSubjectOptions,
  saveExamSubjects,
} = require('../controllers/examModuleController');

const router = express.Router();

router.get('/', requireRole(EXAM_LIST_ROLES), listExams);
router.post('/', requireRole(EXAM_ADMIN_ROLES), createExam);
router.delete('/:id', requireRole(EXAM_ADMIN_ROLES), deleteExam);
router.get('/subjects/list', requireRole(EXAM_LIST_ROLES), listExamSubjects);
router.get('/subjects/options', requireRole(EXAM_LIST_ROLES), listExamSubjectOptions);
router.post('/subjects/save', requireRole([ROLES.TEACHER]), saveExamSubjects);
router.get('/:id/manage-context', requireRole(EXAM_LIST_ROLES), getManageContext);

module.exports = router;

