const path = require('path');

/** Logical folders under each school root (whitelist). */
const ALLOWED_FOLDERS = Object.freeze(['students', 'documents', 'uploads', 'temp']);

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function getMaxUploadBytes() {
  const n = parseInt(process.env.STORAGE_MAX_UPLOAD_BYTES || String(DEFAULT_MAX_BYTES), 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_BYTES;
}

/** Extension → mime allowed for upload (subset). */
const ALLOWED_EXTENSIONS = Object.freeze({
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
  '.svg': ['image/svg+xml'],
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.txt': ['text/plain'],
  '.csv': ['text/csv', 'text/plain'],
});

function getStorageRoot() {
  const configured = String(process.env.STORAGE_ROOT || '').trim();
  if (configured) return path.resolve(configured);
  return path.resolve(process.cwd(), 'storage');
}

module.exports = {
  ALLOWED_FOLDERS,
  ALLOWED_EXTENSIONS,
  getMaxUploadBytes,
  getStorageRoot,
};
