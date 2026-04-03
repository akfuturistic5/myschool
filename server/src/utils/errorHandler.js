/**
 * Centralized error handling - never expose internal details to clients
 */

const { error: errorResponse } = require('./responseHelper');

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Get safe error message for client - never expose stack or DB details
 */
const getSafeMessage = (err, statusCode = 500, defaultMsg = 'Something went wrong') => {
  const msg = err && typeof err.message === 'string' ? err.message.trim() : '';
  // 4xx: safe to show message to client (validation, permissions, multer filter, etc.)
  if (statusCode >= 400 && statusCode < 500 && msg && msg.length > 0 && msg.length < 500) {
    return msg;
  }
  if (isProduction) {
    return defaultMsg;
  }
  if (msg && msg.length < 400) {
    return msg;
  }
  return defaultMsg;
};

/**
 * Global error handler middleware - must be registered last
 */
const globalErrorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  if (!isProduction) {
    console.error('Error:', err.message || err);
    if (err.stack) console.error(err.stack);
  }

  // Multer (file size / field errors) — always return clear messages (safe for clients)
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return errorResponse(
        res,
        413,
        'File is too large. Maximum size is 5 MB. Try a smaller image or compress it before uploading.'
      );
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return errorResponse(res, 400, 'Unexpected upload field. Use the logo file field.');
    }
    return errorResponse(res, 400, err.message || 'Invalid file upload');
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = getSafeMessage(err, statusCode, 'Internal server error');
  return errorResponse(res, statusCode, message);
};

/**
 * Wrap async controller to catch errors and pass to global handler
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  getSafeMessage,
  globalErrorHandler,
  asyncHandler,
  isProduction,
};
