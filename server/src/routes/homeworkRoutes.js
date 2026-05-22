const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { HOMEWORK_MANAGER_ROLES, STUDENT_HOMEWORK_ROLES, PARENT_HOMEWORK_ROLES } = require('../config/roles');
const {
  listHomework,
  getHomework,
  createHomework,
  updateHomework,
  patchHomeworkStatus,
  deleteHomework,
  listRecipients,
  addAttachment,
  deleteAttachment,
  validateCreateHomework,
  validateUpdateHomework,
  validatePatchStatus,
  validateAddAttachment,
} = require('../controllers/homeworkController');
const {
  listSubmissions,
  evaluateSubmission,
  returnSubmission,
  validateEvaluateSubmission,
  validateReturnSubmission,
} = require('../controllers/homeworkSubmissionController');
const {
  listMyHomework,
  getMyHomework,
  submitHomework,
  validateSubmitHomework,
} = require('../controllers/homeworkStudentController');
const { listChildHomework, getChildHomework } = require('../controllers/homeworkParentController');

const router = express.Router();
const manage = requireRole(HOMEWORK_MANAGER_ROLES);
const student = requireRole(STUDENT_HOMEWORK_ROLES);
const parentPortal = requireRole(PARENT_HOMEWORK_ROLES);

router.get('/my', student, listMyHomework);
router.get('/my/:homeworkId', student, getMyHomework);
router.post('/my/:homeworkId/submissions', student, validateSubmitHomework, submitHomework);

router.get('/parent/:studentId', parentPortal, listChildHomework);
router.get('/parent/:studentId/:homeworkId', parentPortal, getChildHomework);

router.get('/', manage, listHomework);
router.post('/', manage, validateCreateHomework, createHomework);

router.put('/submissions/:submissionId/evaluate', manage, validateEvaluateSubmission, evaluateSubmission);
router.patch('/submissions/:submissionId/return', manage, validateReturnSubmission, returnSubmission);
router.delete('/attachments/:attachmentId', manage, deleteAttachment);

router.get('/:id/submissions', manage, listSubmissions);
router.get('/:id/recipients', manage, listRecipients);
router.post('/:id/attachments', manage, validateAddAttachment, addAttachment);
router.patch('/:id/status', manage, validatePatchStatus, patchHomeworkStatus);
router.put('/:id', manage, validateUpdateHomework, updateHomework);
router.delete('/:id', manage, deleteHomework);
router.get('/:id', manage, getHomework);

module.exports = router;

