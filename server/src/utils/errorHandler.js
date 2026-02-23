/**
 * Centralized error handling - never expose internal details to clients
 */

const { error: errorResponse } = require('./responseHelper');

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Get safe error message for client - never expose stack or DB details
 */
const getSafeMessage = (err, defaultMsg = 'Something went wrong') => {
  if (isProduction) {
    return defaultMsg;
  }
  if (err && typeof err.message === 'string' && err.message.length < 200) {
    return err.message;
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
  const statusCode = err.statusCode || err.status || 500;
  const message = getSafeMessage(err, 'Internal server error');
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
