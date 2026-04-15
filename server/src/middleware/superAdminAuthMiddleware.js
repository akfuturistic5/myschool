const jwt = require('jsonwebtoken');
const serverConfig = require('../config/server');
const { error: errorResponse } = require('../utils/responseHelper');

const SUPER_ADMIN_COOKIE_NAME = 'super_admin_auth';

/**
 * Authenticate Super Admin requests.
 * Reads token from HTTP-only cookie or Authorization header and verifies role.
 * Does NOT bind any tenant context (Super Admin operates only on master_db).
 */
const authenticateSuperAdmin = (req, res, next) => {
  try {
    const cookieToken = req.cookies?.[SUPER_ADMIN_COOKIE_NAME] || null;
    const authHeader = req.headers.authorization;
    const bearerToken =
      serverConfig.allowSuperAdminBearerAuth && authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : null;
    const token = cookieToken || bearerToken;

    if (!token) {
      return errorResponse(res, 401, 'Access denied. No super admin token provided.');
    }

    if (!serverConfig.jwtSuperAdminSecret) {
      return errorResponse(res, 500, 'Server configuration error');
    }

    const decoded = jwt.verify(token, serverConfig.jwtSuperAdminSecret);

    if (!decoded || decoded.role !== 'super_admin') {
      return errorResponse(res, 403, 'Forbidden. Super Admin access required.');
    }

    req.superAdmin = decoded;
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return errorResponse(res, 401, 'Super Admin session expired. Please login again.');
    }
    if (err.name === 'JsonWebTokenError') {
      return errorResponse(res, 401, 'Invalid Super Admin token.');
    }
    return errorResponse(res, 401, 'Super Admin authentication failed');
  }
};

/**
 * Require Super Admin role for protected endpoints.
 * This middleware assumes authenticateSuperAdmin has run or will run inline.
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.superAdmin || req.superAdmin.role !== 'super_admin') {
    return errorResponse(res, 403, 'Forbidden. Super Admin access required.');
  }
  return next();
};

module.exports = {
  authenticateSuperAdmin,
  requireSuperAdmin,
  SUPER_ADMIN_COOKIE_NAME,
};

