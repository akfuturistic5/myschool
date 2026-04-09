const multer = require('multer');
const { uploadStudentPdf } = require('../services/documentUploadService');
const { getSchoolIdFromRequest } = require('../utils/schoolContext');
const { success, error: errorResponse } = require('../utils/responseHelper');

/**
 * POST /api/upload
 * multipart: file (PDF), docType: medical | transfer_certificate
 * folder is always documents; max 4MB; school from auth only.
 */
const postUploadPdf = async (req, res) => {
  try {
    const schoolId = getSchoolIdFromRequest(req);
    if (!schoolId) {
      return errorResponse(res, 401, 'School context required');
    }
    const docType = String(req.body?.docType || '').trim();
    if (docType !== 'medical' && docType !== 'transfer_certificate') {
      return errorResponse(res, 400, 'docType must be medical or transfer_certificate');
    }
    const folderField = String(req.body?.folder ?? 'documents').trim();
    if (folderField !== 'documents') {
      return errorResponse(res, 400, 'folder must be documents');
    }
    if (!req.file?.buffer) {
      return errorResponse(res, 400, 'Missing file');
    }

    const { relativePath } = await uploadStudentPdf(
      req.file.buffer,
      req.file.originalname,
      schoolId,
      docType
    );

    const parts = relativePath.split('/');
    const schoolKey = parts[0];
    const storageFolder = parts[1];
    const fileName = parts[2];
    const url = `/api/storage/files/${schoolKey}/${storageFolder}/${encodeURIComponent(fileName)}`;

    return success(res, 200, 'Uploaded', {
      relativePath,
      url,
      docType,
    });
  } catch (err) {
    console.error('postUploadPdf:', err.message);
    if (err.message === 'Only PDF allowed' || err.message.includes('PDF')) {
      return errorResponse(res, 400, 'Only PDF allowed');
    }
    if (err.message.includes('large') || err.message.includes('4MB')) {
      return errorResponse(res, 400, err.message);
    }
    return errorResponse(res, 500, 'Upload failed');
  }
};

function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return errorResponse(res, 400, 'File too large (max 4MB)');
    }
    return errorResponse(res, 400, err.message);
  }
  if (err) {
    return errorResponse(res, 400, err.message || 'Upload rejected');
  }
  next();
}

module.exports = { postUploadPdf, handleMulterError };
