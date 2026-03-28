const { masterQuery } = require('../config/database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const serverConfig = require('../config/server');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { SUPER_ADMIN_COOKIE_NAME } = require('../middleware/superAdminAuthMiddleware');
const crypto = require('crypto');
const { secureCookieBase } = require('../utils/cookiePolicy');

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
      console.error('Error querying master_db.super_admin_users:', e);
      const isDev = process.env.NODE_ENV !== 'production';
      const msg = isDev && e?.message
        ? `Failed to authenticate: ${e.message}`
        : 'Failed to authenticate';
      return errorResponse(res, 500, msg);
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
      console.error('Error querying master_db.super_admin_users profile:', e);
      const isDev = process.env.NODE_ENV !== 'production';
      const msg = isDev && e?.message
        ? `Failed to fetch Super Admin profile: ${e.message}`
        : 'Failed to fetch Super Admin profile';
      return errorResponse(res, 500, msg);
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
  getSuperAdminProfile,
  superAdminLogout,
};

