const jwt = require('jsonwebtoken');
const serverConfig = require('../config/server');
const { error: errorResponse } = require('../utils/responseHelper');
const { runWithTenant, masterQuery } = require('../config/database');
const crypto = require('crypto');

const SESSION_COOKIE_NAME = 'sid';

function sha256Hex(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

async function resolveTenantFromSession(req) {
  const sid = req.cookies?.[SESSION_COOKIE_NAME] || null;
  if (!sid) return null;
  const sessionHash = sha256Hex(sid);
  const r = await masterQuery(
    `
    SELECT
      ts.school_id,
      ts.institute_number,
      ts.db_name,
      ts.tenant_user_id,
      ts.expires_at,
      ts.revoked_at,
      s.status
    FROM tenant_sessions ts
    JOIN schools s ON s.id = ts.school_id
    WHERE ts.session_hash = $1
    LIMIT 1
    `,
    [sessionHash]
  );
  if (!r.rows || r.rows.length === 0) return null;
  const row = r.rows[0];
  if (row.revoked_at) return null;
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return null;
  if (row.status && String(row.status).toLowerCase() === 'disabled') return null;
  return {
    school_id: row.school_id,
    institute_number: row.institute_number,
    db_name: row.db_name,
    tenant_user_id: row.tenant_user_id,
  };
}

const isPublicPath = (path) => {
  const p = path || '';
  return p.includes('/auth/login') || p === '/health' || p.startsWith('/health/');
};

/**
 * Optional auth - skip for public paths, verify for others
 */
const protectApi = (req, res, next) => {
  const path = req.path.replace(/^\/api/, '') || req.path;
  if (isPublicPath(path)) {
    return next();
  }
  return authenticate(req, res, next);
};

/**
 * Verify JWT token and attach user to request.
 * Accepts token from: (1) HTTP-only cookie auth_token, (2) Authorization: Bearer <token>
 */
const authenticate = (req, res, next) => {
  (async () => {
    try {
      const cookieToken = req.cookies?.auth_token || null;
      const authHeader = req.headers.authorization;
      const bearerToken =
        serverConfig.allowLegacyBearerAuth && authHeader && authHeader.startsWith('Bearer ')
          ? authHeader.slice(7)
          : null;
      const token = cookieToken || bearerToken;

      if (!token) {
        return errorResponse(res, 401, 'Access denied. No token provided.');
      }
      if (!serverConfig.jwtSecret) {
        return errorResponse(res, 500, 'Server configuration error');
      }

      const session = await resolveTenantFromSession(req);
      if (!session) {
        return errorResponse(res, 401, 'Session expired. Please login again.');
      }

      const decoded = jwt.verify(token, serverConfig.jwtSecret);

      // Enforce session binding: user id + tenant must match master_db session record.
      if (decoded?.id == null || String(decoded.id) !== String(session.tenant_user_id)) {
        return errorResponse(res, 401, 'Authentication failed');
      }

      req.user = decoded;
      req.tenant = {
        school_id: session.school_id,
        institute_number: session.institute_number,
        db_name: session.db_name,
      };

      // Bind downstream handlers to the tenant DB derived from the server-side session.
      return runWithTenant(session.db_name, () => next());
    } catch (err) {
      if (err?.name === 'TokenExpiredError') {
        return errorResponse(res, 401, 'Token expired. Please login again.');
      }
      if (err?.name === 'JsonWebTokenError') {
        return errorResponse(res, 401, 'Invalid token.');
      }
      return errorResponse(res, 401, 'Authentication failed');
    }
  })().catch(() => errorResponse(res, 401, 'Authentication failed'));
};

module.exports = { authenticate, protectApi };
