const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/rbacMiddleware');
const { ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const {
  getAllFiles,
  getFileById,
  createFile,
  updateFile,
  deleteFile
} = require('../controllers/fileController');

router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getAllFiles);
router.get('/:id', requireRole(ALL_AUTHENTICATED_ROLES), getFileById);
router.post('/', requireRole(ALL_AUTHENTICATED_ROLES), createFile);
router.put('/:id', requireRole(ALL_AUTHENTICATED_ROLES), updateFile);
router.delete('/:id', requireRole(ALL_AUTHENTICATED_ROLES), deleteFile);

module.exports = router;
