const multer = require('multer');

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/svg+xml']);

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  const mime = (file.mimetype || '').toLowerCase();
  if (!ALLOWED.has(mime)) {
    return cb(new Error('Only JPG, PNG, SVG allowed'));
  }
  const name = (file.originalname || '').toLowerCase();
  if (!/\.(jpe?g|png|svg)$/.test(name)) {
    return cb(new Error('Only JPG, PNG, SVG allowed'));
  }
  cb(null, true);
}

const uploadParentProfile = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter,
});

module.exports = { uploadParentProfile, PARENT_PROFILE_MAX_BYTES: MAX_BYTES };
