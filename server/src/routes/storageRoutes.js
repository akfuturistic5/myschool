const express = require('express');
const multer = require('multer');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { upload } = require('../middleware/schoolStorageUpload');
const { uploadSchoolFile, getSchoolFile, deleteSchoolFile } = require('../controllers/storageController');
const { error: errorResponse } = require('../utils/responseHelper');

const router = express.Router();

function uploadWithErrorHandling(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return errorResponse(res, 400, err.message);
    }
    if (err) {
      return errorResponse(res, 400, err.message || 'Upload rejected');
    }
    next();
  });
}

router.post('/upload', requireRole(ALL_AUTHENTICATED_ROLES), uploadWithErrorHandling, uploadSchoolFile);
router.get('/files/:schoolKey/:folder/:filename', requireRole(ALL_AUTHENTICATED_ROLES), getSchoolFile);
router.delete('/file', requireRole(ALL_AUTHENTICATED_ROLES), deleteSchoolFile);

module.exports = router;
