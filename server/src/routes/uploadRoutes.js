const express = require('express');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { uploadStudentPdf } = require('../middleware/documentUploadMulter');
const { postUploadPdf, handleMulterError } = require('../controllers/documentUploadController');

const router = express.Router();

router.post(
  '/upload',
  requireRole(ALL_AUTHENTICATED_ROLES),
  uploadStudentPdf.single('file'),
  handleMulterError,
  postUploadPdf
);

module.exports = router;
