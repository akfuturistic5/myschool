const jwt = require('jsonwebtoken');
const serverConfig = require('../config/server');
const { error: errorResponse } = require('../utils/responseHelper');
const { runWithTenant, masterQuery } = require('../config/database');
const crypto = require('crypto');

const SESSION_COOKIE_NAME = 'sid';

function sha256Hex(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

/**
 * Bearer auth: JWT is signed; bind tenant via master_db.schools (not raw client-supplied db_name alone).
 */
async function resolveBearerTenantContext(bearerRaw) {
  const decoded = jwt.verify(bearerRaw, serverConfig.jwtUserSecret);
  if (decoded?.school_id == null || !decoded?.db_name) {
    const e = new Error('Invalid token payload');
    e.name = 'JsonWebTokenError';
    throw e;
  }
  const schoolRes = await masterQuery(
    `SELECT id, db_name, status, deleted_at
     FROM schools
     WHERE id = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [decoded.school_id]
  );
  const row = schoolRes.rows?.[0];
  if (!row || String(row.db_name) !== String(decoded.db_name)) {
    const e = new Error('School mismatch');
    e.name = 'JsonWebTokenError';
    throw e;
  }
  if (row.status && String(row.status).toLowerCase() === 'disabled') {
    const e = new Error('School disabled');
    e.name = 'JsonWebTokenError';
    throw e;
  }
  return {
    decoded,
    dbName: decoded.db_name,
  };
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
 * Verify JWT and attach user.
 * (1) Cookie auth_token + sid session (preferred when cookies work).
 * (2) Authorization: Bearer when TENANT_BEARER_AUTH (prod) or ALLOW_LEGACY_BEARER_AUTH (dev) — for split SPA/API.
 */
const authenticate = (req, res, next) => {
  (async () => {
    try {
      if (!serverConfig.jwtUserSecret) {
        return errorResponse(res, 500, 'Server configuration error');
      }

      const authHeader = req.headers.authorization || '';
      const bearerRaw =
        authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
      const allowBearer =
        !!bearerRaw &&
        (serverConfig.tenantBearerAuthInProduction || serverConfig.allowLegacyBearerAuth);

      const cookieToken = req.cookies?.auth_token || null;
      const sid = req.cookies?.[SESSION_COOKIE_NAME] || null;

      // Prefer cookie + sid when both exist so a stale sessionStorage Bearer does not block valid cookies.
      if (cookieToken && sid) {
        const session = await resolveTenantFromSession(req);
        if (!session) {
          return errorResponse(res, 401, 'Session expired. Please login again.');
        }
        const decoded = jwt.verify(cookieToken, serverConfig.jwtUserSecret);
        if (decoded?.id == null || String(decoded.id) !== String(session.tenant_user_id)) {
          return errorResponse(res, 401, 'Authentication failed');
        }
        if (decoded?.school_id != null && String(decoded.school_id) !== String(session.school_id)) {
          return errorResponse(res, 401, 'Authentication failed');
        }
        if (decoded?.institute_number && String(decoded.institute_number) !== String(session.institute_number)) {
          return errorResponse(res, 401, 'Authentication failed');
        }
        req.user = decoded;
        req.tenant = {
          school_id: session.school_id,
          institute_number: session.institute_number,
          db_name: session.db_name,
        };
        return runWithTenant(session.db_name, () => next());
      }

      if (allowBearer) {
        try {
          const { decoded, dbName } = await resolveBearerTenantContext(bearerRaw);
          req.user = decoded;
          req.tenant = {
            school_id: decoded.school_id,
            institute_number: decoded.institute_number,
            db_name: dbName,
          };
          req.authViaBearer = true;
          return runWithTenant(dbName, () => next());
        } catch (err) {
          if (err?.name === 'TokenExpiredError') {
            return errorResponse(res, 401, 'Token expired. Please login again.');
          }
          if (err?.name === 'JsonWebTokenError') {
            return errorResponse(res, 401, 'Invalid token.');
          }
          return errorResponse(res, 401, 'Authentication failed');
        }
      }

      if (!cookieToken) {
        return errorResponse(res, 401, 'Access denied. No token provided.');
      }
      return errorResponse(res, 401, 'Session expired. Please login again.');
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
