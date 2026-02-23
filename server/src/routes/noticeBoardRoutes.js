const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { validate } = require('../utils/validate');
const { createNoticeSchema, updateNoticeSchema } = require('../validations/noticeBoardValidation');
const { NOTICE_MANAGER_ROLES } = require('../config/roles');
const {
  getAllNotices,
  getNoticeById,
  createNotice,
  updateNotice,
  deleteNotice,
} = require('../controllers/noticeBoardController');

const router = express.Router();

router.get('/', getAllNotices);
router.get('/:id', getNoticeById);
router.post('/', requireRole(NOTICE_MANAGER_ROLES), validate(createNoticeSchema), createNotice);
router.put('/:id', requireRole(NOTICE_MANAGER_ROLES), validate(updateNoticeSchema), updateNotice);
router.delete('/:id', requireRole(NOTICE_MANAGER_ROLES), deleteNotice);

module.exports = router;
