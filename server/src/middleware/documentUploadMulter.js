const multer = require('multer');
const { STUDENT_PDF_MAX_BYTES } = require('../services/documentUploadService');

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  const ext = (file.originalname || '').toLowerCase().endsWith('.pdf');
  const mime = (file.mimetype || '').toLowerCase();
  if (!ext || mime !== 'application/pdf') {
    return cb(new Error('Only PDF allowed'));
  }
  cb(null, true);
}

const uploadStudentPdf = multer({
  storage,
  limits: { fileSize: STUDENT_PDF_MAX_BYTES, files: 1 },
  fileFilter,
});

module.exports = { uploadStudentPdf };
