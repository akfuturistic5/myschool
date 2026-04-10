const multer = require('multer');
const path = require('path');
const { getMaxUploadBytes, ALLOWED_EXTENSIONS } = require('../storage/schoolStorageConfig');

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS[ext]) {
    return cb(new Error(`File type not allowed: ${ext || '(no extension)'}`));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  limits: { fileSize: getMaxUploadBytes(), files: 1 },
  fileFilter,
});

module.exports = { upload };
