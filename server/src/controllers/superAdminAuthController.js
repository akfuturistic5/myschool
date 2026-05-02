const { masterQuery } = require('../config/database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const serverConfig = require('../config/server');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { SUPER_ADMIN_COOKIE_NAME } = require('../middleware/superAdminAuthMiddleware');
const crypto = require('crypto');
const { secureCookieBase } = require('../utils/cookiePolicy');
const { verifySuperAdminPassword, writeSuperAdminAudit } = require('../utils/superAdminSecurity');

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Maps master_db (PostgreSQL) connectivity errors to safe API responses.
 * Login failures from wrong Super Admin password must stay 401 — this is only for DB unreachable / bad DB credentials.
 */
function respondMasterDbQueryError(res, err, { generic500Message, logLabel }) {
  console.error(logLabel, err);
  const msg = String(err && err.message ? err.message : '');
  const code = err && err.code ? String(err.code) : '';
  const authFailed =
    code === '28P01' || /password authentication failed/i.test(msg) || /authentication failed/i.test(msg);
  const connRefused = code === 'ECONNREFUSED';
  const timeout =
    /timeout/i.test(msg) || code === 'ETIMEDOUT' || code === '57014';

  if (!isProduction && authFailed) {
    return errorResponse(
      res,
      503,
      'Master database (master_db) rejected the connection (wrong DB user/password). Set MASTER_DATABASE_URL, or fix DB_USER and DB_PASSWORD so the same PostgreSQL instance can open database "master_db". See server/.env.example.'
    );
  }
  if (!isProduction && connRefused) {
    return errorResponse(
      res,
      503,
      'Cannot connect to PostgreSQL for master_db (connection refused). Check DB_HOST, DB_PORT, and that the server is running.'
    );
  }
  if (!isProduction && timeout) {
    return errorResponse(
      res,
      503,
      'Master database (master_db) connection timed out. Check network, MASTER_DATABASE_URL, and DB_CONNECTION_TIMEOUT_MS.'
    );
  }

  if (authFailed || connRefused || timeout) {
    return errorResponse(res, 503, 'Authentication service temporarily unavailable.');
  }

  return errorResponse(res, 500, generic500Message);
}

const getSuperAdminCookieOptions = () => {
  const { sameSite, secure } = secureCookieBase();
  const maxAgeMs = 24 * 60 * 60 * 1000; // 1 day
  return {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: maxAgeMs,
    path: '/',
  };
};

const getCsrfCookieOptions = () => {
  const { sameSite, secure } = secureCookieBase();
  return {
    httpOnly: false,
    secure,
    sameSite,
    path: '/',
  };
};

/**
 * Super Admin login - authenticate against master_db.super_admin_users
 * using email OR username plus password (bcrypt).
 */
const superAdminLogin = async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body || {};

    if (!emailOrUsername || !password) {
      return errorResponse(res, 400, 'Email/username and password are required');
    }

    if (!serverConfig.jwtSuperAdminSecret) {
      return errorResponse(res, 500, 'Server configuration error');
    }

    const identifier = String(emailOrUsername).trim();
    const enteredPassword = String(password || '').trim();

    let result;
    try {
      result = await masterQuery(
        `
          SELECT
            id,
            username,
            email,
            password_hash,
            role,
            is_active,
            created_at,
            updated_at
          FROM super_admin_users
          WHERE (LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1))
          LIMIT 1
        `,
        [identifier]
      );
    } catch (e) {
      return respondMasterDbQueryError(res, e, {
        generic500Message: 'Failed to authenticate',
        logLabel: 'Error querying master_db.super_admin_users:',
      });
    }

    if (!result.rows || result.rows.length === 0) {
      return errorResponse(res, 401, 'Invalid credentials');
    }

    const admin = result.rows[0];

    if (admin.is_active === false || admin.is_active === 'f' || admin.is_active === 0) {
      return errorResponse(res, 403, 'Super Admin account is disabled');
    }

    const passwordHash = admin.password_hash;
    if (!passwordHash) {
      return errorResponse(res, 401, 'Invalid credentials');
    }

    let passwordValid = false;
    try {
      passwordValid = await bcrypt.compare(enteredPassword, passwordHash);
    } catch {
      passwordValid = false;
    }

    if (!passwordValid) {
      return errorResponse(res, 401, 'Invalid credentials');
    }

    const payload = {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role: 'super_admin',
    };

    const token = jwt.sign(
      payload,
      serverConfig.jwtSuperAdminSecret,
      { expiresIn: serverConfig.jwtExpiresIn || '1d' }
    );

    res.cookie(SUPER_ADMIN_COOKIE_NAME, token, getSuperAdminCookieOptions());
    // Ensure CSRF cookie exists for SPA requests after login.
    const csrfToken = crypto.randomBytes(16).toString('base64url');
    res.cookie('XSRF-TOKEN', csrfToken, getCsrfCookieOptions());

    return success(res, 200, 'Super Admin login successful', {
      csrfToken,
      user: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: 'super_admin',
      },
    });
  } catch (err) {
    console.error('Super Admin login error:', err);
    return errorResponse(res, 500, 'Super Admin login failed');
  }
};

/**
 * Lightweight session probe for SPA bootstrap: always HTTP 200.
 * Avoids 401 on /me before login (browsers log failing fetch as console errors).
 */
const getSuperAdminSession = async (req, res) => {
  try {
    const sa = req.superAdmin;
    if (!sa || !sa.id) {
      return success(res, 200, 'OK', { authenticated: false });
    }

    let result;
    try {
      result = await masterQuery(
        `
          SELECT id, username, email, role, is_active
          FROM super_admin_users
          WHERE id = $1
          LIMIT 1
        `,
        [sa.id]
      );
    } catch (e) {
      return respondMasterDbQueryError(res, e, {
        generic500Message: 'Failed to verify Super Admin session',
        logLabel: 'Error querying master_db.super_admin_users (session):',
      });
    }

    if (!result.rows || result.rows.length === 0) {
      return success(res, 200, 'OK', { authenticated: false });
    }

    const admin = result.rows[0];
    if (admin.is_active === false || admin.is_active === 'f' || admin.is_active === 0) {
      return success(res, 200, 'OK', { authenticated: false });
    }

    return success(res, 200, 'OK', {
      authenticated: true,
      user: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role || 'super_admin',
      },
    });
  } catch (err) {
    console.error('Super Admin session error:', err);
    return errorResponse(res, 500, 'Failed to verify Super Admin session');
  }
};

/**
 * Get current Super Admin profile from master_db.
 * Requires authentication via authenticateSuperAdmin middleware.
 */
const getSuperAdminProfile = async (req, res) => {
  try {
    const sa = req.superAdmin;
    if (!sa || !sa.id) {
      return errorResponse(res, 401, 'Not authenticated as Super Admin');
    }

    let result;
    try {
      result = await masterQuery(
        `
          SELECT
            id,
            username,
            email,
            role,
            is_active,
            created_at,
            updated_at
          FROM super_admin_users
          WHERE id = $1
          LIMIT 1
        `,
        [sa.id]
      );
    } catch (e) {
      return respondMasterDbQueryError(res, e, {
        generic500Message: 'Failed to fetch Super Admin profile',
        logLabel: 'Error querying master_db.super_admin_users profile:',
      });
    }

    if (!result.rows || result.rows.length === 0) {
      return errorResponse(res, 404, 'Super Admin not found');
    }

    const admin = result.rows[0];

    return success(res, 200, 'Super Admin profile fetched', {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role: admin.role || 'super_admin',
      is_active: admin.is_active,
      created_at: admin.created_at,
      updated_at: admin.updated_at,
    });
  } catch (err) {
    console.error('Get Super Admin profile error:', err);
    return errorResponse(res, 500, 'Failed to fetch Super Admin profile');
  }
};

/**
 * Update username in master_db.super_admin_users (current password required).
 * Enforces UNIQUE username with case-insensitive conflict check (aligned with login lookup).
 */
const updateSuperAdminProfile = async (req, res) => {
  try {
    const sa = req.superAdmin;
    if (!sa || !sa.id) {
      return errorResponse(res, 401, 'Not authenticated');
    }
    const { username, currentPassword } = req.body || {};
    const trimmed = String(username || '').trim();
    if (trimmed.length < 2 || trimmed.length > 150) {
      return errorResponse(res, 400, 'Username must be between 2 and 150 characters');
    }

    const ok = await verifySuperAdminPassword(sa.id, currentPassword);
    if (!ok) {
      return errorResponse(res, 400, 'Current password is incorrect');
    }

    const selfRow = await masterQuery(
      `SELECT username, email FROM super_admin_users WHERE id = $1 AND (is_active IS DISTINCT FROM false) LIMIT 1`,
      [sa.id]
    );
    if (!selfRow.rows?.length) {
      return errorResponse(res, 404, 'Super Admin user not found');
    }
    const prevUsername = String(selfRow.rows[0].username || '');

    if (prevUsername === trimmed) {
      return success(res, 200, 'No changes to apply', {
        id: sa.id,
        username: trimmed,
        email: selfRow.rows[0].email,
      });
    }

    const dup = await masterQuery(
      `SELECT id FROM super_admin_users WHERE LOWER(username) = LOWER($1) AND id <> $2 LIMIT 1`,
      [trimmed, sa.id]
    );
    if (dup.rows && dup.rows.length > 0) {
      return errorResponse(res, 400, 'This username is already taken');
    }

    let r;
    try {
      r = await masterQuery(
        `UPDATE super_admin_users SET username = $1, updated_at = NOW() WHERE id = $2 AND (is_active IS DISTINCT FROM false)`,
        [trimmed, sa.id]
      );
    } catch (e) {
      if (e && e.code === '23505') {
        return errorResponse(res, 400, 'This username is already taken');
      }
      throw e;
    }
    if (!r.rowCount) {
      return errorResponse(res, 404, 'Super Admin user not found');
    }

    const fresh = await masterQuery(
      `SELECT id, username, email FROM super_admin_users WHERE id = $1 LIMIT 1`,
      [sa.id]
    );
    const row = fresh.rows[0];

    await writeSuperAdminAudit({
      superAdminId: sa.id,
      action: 'username_changed',
      resourceType: 'super_admin_user',
      resourceId: String(sa.id),
      details: { from: prevUsername, to: trimmed },
      req,
    });

    return success(res, 200, 'Username updated successfully', {
      id: row.id,
      username: row.username,
      email: row.email,
    });
  } catch (err) {
    console.error('Super Admin update profile error:', err);
    return errorResponse(res, 500, 'Failed to update username');
  }
};

/**
 * Change password for the authenticated Super Admin (current password required).
 */
const changeSuperAdminPassword = async (req, res) => {
  try {
    const sa = req.superAdmin;
    if (!sa || !sa.id) {
      return errorResponse(res, 401, 'Not authenticated');
    }
    const { currentPassword, newPassword } = req.body || {};

    const ok = await verifySuperAdminPassword(sa.id, currentPassword);
    if (!ok) {
      return errorResponse(res, 400, 'Current password is incorrect');
    }

    const nextHash = await bcrypt.hash(String(newPassword), 10);
    const r = await masterQuery(
      `UPDATE super_admin_users SET password_hash = $1, updated_at = NOW() WHERE id = $2 AND (is_active IS DISTINCT FROM false)`,
      [nextHash, sa.id]
    );
    if (!r.rowCount) {
      return errorResponse(res, 404, 'Super Admin user not found');
    }

    const profile = await masterQuery(
      `SELECT id, username, email FROM super_admin_users WHERE id = $1 LIMIT 1`,
      [sa.id]
    );
    const row = profile.rows?.[0];

    await writeSuperAdminAudit({
      superAdminId: sa.id,
      action: 'password_changed',
      resourceType: 'super_admin_user',
      resourceId: String(sa.id),
      req,
    });

    return success(res, 200, 'Password changed successfully', {
      id: row?.id ?? sa.id,
      username: row?.username,
      email: row?.email,
    });
  } catch (err) {
    console.error('Super Admin change password error:', err);
    return errorResponse(res, 500, 'Failed to change password');
  }
};

/**
 * Super Admin logout - clear dedicated HTTP-only cookie.
 */
const superAdminLogout = (req, res) => {
  const opts = getSuperAdminCookieOptions();
  res.clearCookie(SUPER_ADMIN_COOKIE_NAME, {
    httpOnly: opts.httpOnly,
    secure: opts.secure,
    sameSite: opts.sameSite,
    path: opts.path,
  });
  return success(res, 200, 'Super Admin logged out successfully', null);
};

module.exports = {
  superAdminLogin,
  getSuperAdminSession,
  getSuperAdminProfile,
  updateSuperAdminProfile,
  changeSuperAdminPassword,
  superAdminLogout,
};

