const { query, masterQuery, runWithTenant, executeTransaction } = require('../config/database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const serverConfig = require('../config/server');
const { success, error: errorResponse } = require('../utils/responseHelper');
const crypto = require('crypto');
const { secureCookieBase } = require('../utils/cookiePolicy');
const { getSchoolProfile } = require('../services/schoolProfileService');

const AUTH_COOKIE_NAME = 'auth_token';
const SESSION_COOKIE_NAME = 'sid';

/** Cookie options for HTTP-only auth cookie. SameSite=None for cross-origin (e.g. Render frontend/backend). */
const getAuthCookieOptions = () => {
  const { sameSite, secure } = secureCookieBase();
  const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
  return {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: maxAgeMs,
    path: '/',
  };
};

const getSessionCookieOptions = () => {
  const { sameSite, secure } = secureCookieBase();
  const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
  return {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: maxAgeMs,
    path: '/',
  };
};

// Double-submit CSRF cookie (readable by JS; paired with X-XSRF-TOKEN header)
const getCsrfCookieOptions = () => {
  const { sameSite, secure } = secureCookieBase();
  return {
    httpOnly: false,
    secure,
    sameSite,
    path: '/',
  };
};

function newOpaqueSessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}
function sha256Hex(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

const GENERIC_LOGIN_FAIL = 'Invalid credentials';

/**
 * Login - authenticate user with username/phone and password (bcrypt password_hash).
 * Lookup by username, email, or phone. Same error message for all auth failures (no user/institute enumeration).
 */
const login = async (req, res) => {
  try {
    const { username, password, instituteNumber, institute_number } = req.body;

    const institute = (instituteNumber || institute_number || '').toString().trim();
    if (!institute) {
      return errorResponse(res, 400, 'Institute number is required');
    }

    // Resolve school and target DB from master_db (ignore soft-deleted schools)
    let school;
    try {
      const schoolRes = await masterQuery(
        `SELECT id, school_name, type, logo, institute_number, db_name, status, deleted_at
         FROM schools
         WHERE institute_number = $1 AND deleted_at IS NULL
         LIMIT 1`,
        [institute]
      );
      if (schoolRes.rows.length === 0) {
        return errorResponse(res, 401, GENERIC_LOGIN_FAIL);
      }
      const s = schoolRes.rows[0];
      if (s.deleted_at || (s.status && String(s.status).toLowerCase() === 'disabled')) {
        return errorResponse(res, 401, GENERIC_LOGIN_FAIL);
      }
      school = s;
    } catch (e) {
      console.error('Error querying master_db.schools:', e);
      return errorResponse(res, 500, 'Login failed');
    }

    const targetDbName = school.db_name;

    if (!username || !password) {
      return errorResponse(res, 400, 'Username and password are required');
    }

    if (!serverConfig.jwtUserSecret) {
      return errorResponse(res, 500, 'Server configuration error');
    }

    const identifier = username.trim().toString();
    const enteredPassword = (password || '').toString().trim();

    await runWithTenant(targetDbName, async () => {
      let userResult;
      try {
        userResult = await query(
          `SELECT u.id, u.username, u.first_name, u.last_name, u.role_id,
                  u.phone, u.password_hash,
                  ur.role_name,
                  st.id as staff_id, st.first_name as staff_first_name, st.last_name as staff_last_name
           FROM users u
           LEFT JOIN user_roles ur ON u.role_id = ur.id
           LEFT JOIN staff st ON u.id = st.user_id AND st.is_active = true
           WHERE u.is_active = true
             AND (u.username = $1 OR u.email = $1 OR u.phone = $1)
           LIMIT 1`,
          [identifier]
        );
      } catch (e) {
        if (e.message && (e.message.includes('email') || e.message.includes('password_hash'))) {
          userResult = await query(
            `SELECT u.id, u.username, u.first_name, u.last_name, u.role_id,
                    u.phone, u.password_hash,
                    ur.role_name,
                    st.id as staff_id, st.first_name as staff_first_name, st.last_name as staff_last_name
             FROM users u
             LEFT JOIN user_roles ur ON u.role_id = ur.id
             LEFT JOIN staff st ON u.id = st.user_id AND st.is_active = true
             WHERE u.is_active = true AND (u.username = $1 OR u.phone = $1)
             LIMIT 1`,
            [identifier]
          );
        } else {
          throw e;
        }
      }

      if (userResult.rows.length === 0) {
        return errorResponse(res, 401, GENERIC_LOGIN_FAIL);
      }

      const user = userResult.rows[0];
      const storedPhone = (user.phone || '').toString().trim();
      const passwordHash = user.password_hash;

      if (!storedPhone && !passwordHash) {
        return errorResponse(res, 401, GENERIC_LOGIN_FAIL);
      }

      let passwordValid = false;
      if (passwordHash) {
        try {
          passwordValid = await bcrypt.compare(enteredPassword, passwordHash);
        } catch {
          passwordValid = false;
        }
      }

      if (!passwordValid) {
        return errorResponse(res, 401, GENERIC_LOGIN_FAIL);
      }

      const payload = {
        id: user.id,
        username: user.username,
        role_id: user.role_id,
        role_name: user.role_name || 'User',
        // NOTE: db_name is kept for backward compatibility but MUST NOT be trusted
        // for tenant selection. Tenant selection is bound to the server-side session.
        db_name: targetDbName,
        school_id: school.id,
        school_name: school.school_name,
        school_type: school.type,
        school_logo: school.logo || null,
        institute_number: school.institute_number,
      };

      const token = jwt.sign(
        payload,
        serverConfig.jwtUserSecret,
        { expiresIn: serverConfig.jwtExpiresIn || '7d' }
      );

      const displayName = (user.staff_first_name || user.first_name)
        ? `${user.staff_first_name || user.first_name} ${user.staff_last_name || user.last_name}`.trim()
        : user.username;

      let accountDisabled = false;
      try {
        const accCheck = await query(
          `SELECT s.id AS student_id, s.is_active AS student_is_active, st.id AS staff_id, st.is_active AS staff_is_active
           FROM users u
           LEFT JOIN students s ON u.id = s.user_id
           LEFT JOIN staff st ON u.id = st.user_id
           WHERE u.id = $1`,
          [user.id]
        );
        if (accCheck.rows.length > 0) {
          const r = accCheck.rows[0];
          const sid = r.student_id;
          const sActive = r.student_is_active;
          const tid = r.staff_id;
          const tActive = r.staff_is_active;
          const studentInactive = sid != null && (sActive === false || sActive === 'f' || sActive === 0);
          const staffInactive = tid != null && (tActive === false || tActive === 'f' || tActive === 0);
          accountDisabled = !!studentInactive || !!staffInactive;
        }
      } catch {
        // ignore; accountDisabled stays false
      }

      res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());

      // Bind tenant context to an opaque server-side session (prevents tenant switching with forged JWT).
      const sessionToken = newOpaqueSessionToken();
      const sessionHash = sha256Hex(sessionToken);
      const now = Date.now();
      const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
      const expiresAt = new Date(now + maxAgeMs);
      try {
        await masterQuery(
          `
          INSERT INTO tenant_sessions (session_hash, school_id, institute_number, db_name, tenant_user_id, expires_at, user_agent, ip_address)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            sessionHash,
            school.id,
            school.institute_number,
            targetDbName,
            user.id,
            expiresAt,
            String(req.headers['user-agent'] || '').slice(0, 2000) || null,
            String(req.headers['x-forwarded-for'] || req.ip || '').slice(0, 100) || null,
          ]
        );
      } catch (e) {
        console.error('Failed to create tenant session in master_db:', e);
        return errorResponse(res, 500, 'Login failed');
      }
      res.cookie(SESSION_COOKIE_NAME, sessionToken, getSessionCookieOptions());

      // Ensure CSRF cookie exists for SPA; token is validated via header on unsafe methods.
      const csrfToken = crypto.randomBytes(16).toString('base64url');
      res.cookie('XSRF-TOKEN', csrfToken, getCsrfCookieOptions());

      const responseData = {
        csrfToken,
        user: {
          id: user.id,
          username: user.username,
          displayName,
          role: user.role_name || 'User',
          role_id: user.role_id,
          staff_id: user.staff_id,
          accountDisabled,
          school_name: school.school_name,
          school_type: school.type,
          school_logo: school.logo || null,
          institute_number: school.institute_number,
        },
      };
      // Split SPA/API: client sends Authorization Bearer when cookies do not cross origins.
      if (serverConfig.tenantBearerAuthInProduction || serverConfig.allowLegacyBearerAuth) {
        responseData.accessToken = token;
      }
      success(res, 200, 'Login successful', responseData);
    });
  } catch (err) {
    console.error('Login error:', err);
    errorResponse(res, 500, 'Login failed');
  }
};

/**
 * Get current user from token - returns full user details from DB (like getUserById)
 * so students/parents can get their profile without needing Admin permission
 */
    const getMe = async (req, res) => {
  try {
    const tokenUser = req.user;
    if (!tokenUser || !tokenUser.id) {
      return errorResponse(res, 401, 'Not authenticated');
    }
    // Ensure CSRF cookie exists for SPA after session restoration.
    if (!req.cookies?.['XSRF-TOKEN']) {
      const csrfToken = crypto.randomBytes(16).toString('base64url');
      res.cookie('XSRF-TOKEN', csrfToken, getCsrfCookieOptions());
    }
    const result = await query(
      `SELECT 
        u.*,
        s.id AS student_id,
        s.first_name AS student_first_name,
        s.last_name AS student_last_name,
        s.is_active AS student_is_active,
        c.class_name,
        sec.section_name,
        st.id AS staff_id,
        st.first_name AS staff_first_name,
        st.last_name AS staff_last_name,
        st.is_active AS staff_is_active,
        d.designation_name,
        ur.role_name
      FROM users u
      LEFT JOIN students s ON u.id = s.user_id
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      LEFT JOIN staff st ON u.id = st.user_id
      LEFT JOIN designations d ON st.designation_id = d.id
      LEFT JOIN user_roles ur ON u.role_id = ur.id
      WHERE u.id = $1 AND u.is_active = true`,
      [tokenUser.id]
    );
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'User not found');
    }
    const user = result.rows[0];
    // Never expose password hashes or internal auth fields to clients.
    if (user && Object.prototype.hasOwnProperty.call(user, 'password_hash')) {
      delete user.password_hash;
    }
    const hasStudent = user.student_id != null;
    const hasStaff = user.staff_id != null;
    const studentInactive = hasStudent && (user.student_is_active === false || user.student_is_active === 'f' || user.student_is_active === 0);
    const staffInactive = hasStaff && (user.staff_is_active === false || user.staff_is_active === 'f' || user.staff_is_active === 0);
    const accountDisabled = !!studentInactive || !!staffInactive;

    let displayName = '';
    let displayRole = '';
    if (user.student_first_name || user.student_last_name) {
      displayName = `${user.student_first_name || ''} ${user.student_last_name || ''}`.trim();
      displayRole = user.role_name || 'Student';
    } else if (user.staff_first_name || user.staff_last_name) {
      displayName = `${user.staff_first_name || ''} ${user.staff_last_name || ''}`.trim();
      displayRole = user.designation_name || user.role_name || 'Teacher';
    } else {
      displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || 'User';
      displayRole = user.role_name || 'User';
    }
    let schoolLogo = tokenUser.school_logo != null ? tokenUser.school_logo : null;
    if (tokenUser.school_id != null) {
      try {
        const logoRes = await masterQuery(
          `SELECT logo FROM schools WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
          [tokenUser.school_id]
        );
        if (logoRes.rows?.[0] && Object.prototype.hasOwnProperty.call(logoRes.rows[0], 'logo')) {
          schoolLogo = logoRes.rows[0].logo;
        }
      } catch (e) {
        console.warn('getMe: could not load school logo from master_db:', e.message);
      }
    }
    if (!String(schoolLogo || '').trim()) {
      try {
        const profile = await getSchoolProfile(tokenUser.school_name || null);
        const profileLogo = String(profile?.logo_url || '').trim();
        if (profileLogo) {
          schoolLogo = profileLogo;
        }
      } catch (e) {
        console.warn('getMe: could not load school logo from school_profile:', e.message);
      }
    }

    const userData = {
      ...user,
      display_name: displayName,
      display_role: displayRole,
      account_disabled: accountDisabled,
      school_name: tokenUser.school_name,
      school_type: tokenUser.school_type,
      school_logo: schoolLogo,
      institute_number: tokenUser.institute_number,
    };
    success(res, 200, 'User fetched', userData);
  } catch (err) {
    console.error('GetMe error:', err);
    errorResponse(res, 500, 'Failed to fetch user');
  }
};

/**
 * Logout - clear HTTP-only auth cookie
 */
const logout = (req, res) => {
  // Bearer sessions: revoke all active DB rows for this user+school (stateless JWT has no single sid).
  if (serverConfig.tenantBearerAuthInProduction) {
    const authz = req.headers.authorization || '';
    if (authz.startsWith('Bearer ')) {
      try {
        const raw = authz.slice(7).trim();
        const dec = jwt.verify(raw, serverConfig.jwtUserSecret);
        if (dec?.id != null && dec?.school_id != null) {
          masterQuery(
            `UPDATE tenant_sessions SET revoked_at = NOW()
             WHERE tenant_user_id = $1 AND school_id = $2 AND revoked_at IS NULL`,
            [dec.id, dec.school_id]
          ).catch(() => {});
        }
      } catch (_) {
        /* ignore invalid bearer on logout */
      }
    }
  }
  // Best-effort server-side session revocation (cookie flow).
  const sid = req.cookies?.[SESSION_COOKIE_NAME] || null;
  if (sid) {
    const sessionHash = sha256Hex(sid);
    masterQuery(
      `UPDATE tenant_sessions SET revoked_at = NOW() WHERE session_hash = $1 AND revoked_at IS NULL`,
      [sessionHash]
    ).catch(() => {});
  }
  const opts = getAuthCookieOptions();
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: opts.httpOnly,
    secure: opts.secure,
    sameSite: opts.sameSite,
    path: opts.path,
  });
  const sopts = getSessionCookieOptions();
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: sopts.httpOnly,
    secure: sopts.secure,
    sameSite: sopts.sameSite,
    path: sopts.path,
  });
  success(res, 200, 'Logged out successfully', null);
};

async function getTableColumns(client, tableName) {
  const r = await client.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    `,
    [tableName]
  );
  return new Set((r.rows || []).map((x) => String(x.column_name)));
}

/**
 * Update current user's own profile (and latest address).
 * - No schema changes
 * - Updates only columns that exist in this tenant DB
 * - If linked student/staff exists, updates their first/last name too
 */
const updateMe = async (req, res) => {
  try {
    const tokenUser = req.user;
    if (!tokenUser || !tokenUser.id) {
      return errorResponse(res, 401, 'Not authenticated');
    }

    const userId = parseInt(tokenUser.id, 10);
    const {
      first_name,
      last_name,
      email,
      phone,
      current_address,
      permanent_address,
    } = req.body || {};

    const resultUser = await executeTransaction(async (client) => {
      const userCols = await getTableColumns(client, 'users');
      const studentCols = await getTableColumns(client, 'students');
      const staffCols = await getTableColumns(client, 'staff');

      // Load current user and linkage
      const base = await client.query(
        `
        SELECT
          u.id,
          u.role_id,
          s.id AS student_id,
          st.id AS staff_id
        FROM users u
        LEFT JOIN students s ON u.id = s.user_id
        LEFT JOIN staff st ON u.id = st.user_id
        WHERE u.id = $1 AND u.is_active = true
        LIMIT 1
        `,
        [userId]
      );
      if (!base.rows || base.rows.length === 0) {
        return null;
      }
      const link = base.rows[0];

      // Update users table fields (only if columns exist)
      const userUpdates = [];
      const userParams = [];
      const pushUser = (col, val) => {
        userUpdates.push(`${col} = $${userParams.length + 1}`);
        userParams.push(val);
      };

      if (userCols.has('first_name') && first_name !== undefined) pushUser('first_name', first_name || null);
      if (userCols.has('last_name') && last_name !== undefined) pushUser('last_name', last_name || null);
      if (userCols.has('email') && email !== undefined) pushUser('email', email || null);
      if (userCols.has('phone') && phone !== undefined) pushUser('phone', phone || null);
      if (userCols.has('current_address') && current_address !== undefined) {
        pushUser('current_address', current_address || null);
      }
      if (userCols.has('permanent_address') && permanent_address !== undefined) {
        pushUser('permanent_address', permanent_address || null);
      }

      if (userUpdates.length > 0) {
        userParams.push(userId);
        await client.query(
          `UPDATE users SET ${userUpdates.join(', ')} WHERE id = $${userParams.length} AND is_active = true`,
          userParams
        );
      }

      // If this user is a student/staff, keep their person-name in sync when requested
      const hasNameUpdate = first_name !== undefined || last_name !== undefined;
      if (hasNameUpdate && link.student_id != null && studentCols.has('first_name') && studentCols.has('last_name')) {
        const sFirst = first_name !== undefined ? (first_name || null) : undefined;
        const sLast = last_name !== undefined ? (last_name || null) : undefined;
        const sUpdates = [];
        const sParams = [];
        if (sFirst !== undefined) { sUpdates.push(`first_name = $${sParams.length + 1}`); sParams.push(sFirst); }
        if (sLast !== undefined) { sUpdates.push(`last_name = $${sParams.length + 1}`); sParams.push(sLast); }
        if (sUpdates.length > 0) {
          sParams.push(userId);
          await client.query(
            `UPDATE students SET ${sUpdates.join(', ')} WHERE user_id = $${sParams.length}`,
            sParams
          );
        }
      }

      if (hasNameUpdate && link.staff_id != null && staffCols.has('first_name') && staffCols.has('last_name')) {
        const tFirst = first_name !== undefined ? (first_name || null) : undefined;
        const tLast = last_name !== undefined ? (last_name || null) : undefined;
        const tUpdates = [];
        const tParams = [];
        if (tFirst !== undefined) { tUpdates.push(`first_name = $${tParams.length + 1}`); tParams.push(tFirst); }
        if (tLast !== undefined) { tUpdates.push(`last_name = $${tParams.length + 1}`); tParams.push(tLast); }
        if (tUpdates.length > 0) {
          tParams.push(userId);
          await client.query(
            `UPDATE staff SET ${tUpdates.join(', ')} WHERE user_id = $${tParams.length}`,
            tParams
          );
        }
      }

      // Address: update latest row if exists, else insert a new one.
      // Return fresh /auth/me-like payload by calling getMe-like query (but within same client)
      let me;
      try {
        me = await client.query(
          `SELECT 
            u.*,
            s.id AS student_id,
            s.first_name AS student_first_name,
            s.last_name AS student_last_name,
            s.is_active AS student_is_active,
            c.class_name,
            sec.section_name,
            st.id AS staff_id,
            st.first_name AS staff_first_name,
            st.last_name AS staff_last_name,
            st.is_active AS staff_is_active,
            d.designation_name,
            ur.role_name,
            addr.address_id,
            addr.current_address,
            addr.permanent_address
          FROM users u
          LEFT JOIN students s ON u.id = s.user_id
          LEFT JOIN classes c ON s.class_id = c.id
          LEFT JOIN sections sec ON s.section_id = sec.id
          LEFT JOIN staff st ON u.id = st.user_id
          LEFT JOIN designations d ON st.designation_id = d.id
          LEFT JOIN user_roles ur ON u.role_id = ur.id
          LEFT JOIN LATERAL (
            SELECT id AS address_id, current_address, permanent_address
            FROM addresses
            WHERE user_id = u.id
            ORDER BY id DESC
            LIMIT 1
          ) addr ON true
          WHERE u.id = $1 AND u.is_active = true`,
          [userId]
        );
      } catch (e) {
        me = await client.query(
          `SELECT 
            u.*,
            s.id AS student_id,
            s.first_name AS student_first_name,
            s.last_name AS student_last_name,
            s.is_active AS student_is_active,
            c.class_name,
            sec.section_name,
            st.id AS staff_id,
            st.first_name AS staff_first_name,
            st.last_name AS staff_last_name,
            st.is_active AS staff_is_active,
            d.designation_name,
            ur.role_name
          FROM users u
          LEFT JOIN students s ON u.id = s.user_id
          LEFT JOIN classes c ON s.class_id = c.id
          LEFT JOIN sections sec ON s.section_id = sec.id
          LEFT JOIN staff st ON u.id = st.user_id
          LEFT JOIN designations d ON st.designation_id = d.id
          LEFT JOIN user_roles ur ON u.role_id = ur.id
          WHERE u.id = $1 AND u.is_active = true`,
          [userId]
        );
      }
      return me.rows[0] || null;
    });

    if (!resultUser) {
      return errorResponse(res, 404, 'User not found');
    }

    // Compute display fields same as getMe
    const user = resultUser;
    // Never expose password hashes or internal auth fields to clients.
    if (user && Object.prototype.hasOwnProperty.call(user, 'password_hash')) {
      delete user.password_hash;
    }
    const hasStudent = user.student_id != null;
    const hasStaff = user.staff_id != null;
    const studentInactive = hasStudent && (user.student_is_active === false || user.student_is_active === 'f' || user.student_is_active === 0);
    const staffInactive = hasStaff && (user.staff_is_active === false || user.staff_is_active === 'f' || user.staff_is_active === 0);
    const accountDisabled = !!studentInactive || !!staffInactive;

    let displayName = '';
    let displayRole = '';
    if (user.student_first_name || user.student_last_name) {
      displayName = `${user.student_first_name || ''} ${user.student_last_name || ''}`.trim();
      displayRole = user.role_name || 'Student';
    } else if (user.staff_first_name || user.staff_last_name) {
      displayName = `${user.staff_first_name || ''} ${user.staff_last_name || ''}`.trim();
      displayRole = user.designation_name || user.role_name || 'Teacher';
    } else {
      displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || 'User';
      displayRole = user.role_name || 'User';
    }

    const userData = {
      ...user,
      display_name: displayName,
      display_role: displayRole,
      account_disabled: accountDisabled,
      school_name: tokenUser.school_name,
      school_type: tokenUser.school_type,
      institute_number: tokenUser.institute_number,
    };

    success(res, 200, 'Profile updated', userData);
  } catch (err) {
    console.error('UpdateMe error:', err);
    errorResponse(res, 500, 'Failed to update profile');
  }
};

/**
 * Change password for current user.
 * Verifies current password against users.password_hash and updates it with bcrypt hash.
 */
const changePassword = async (req, res) => {
  try {
    const tokenUser = req.user;
    if (!tokenUser || !tokenUser.id) {
      return errorResponse(res, 401, 'Not authenticated');
    }
    const userId = parseInt(tokenUser.id, 10);
    const { currentPassword, newPassword } = req.body || {};

    await executeTransaction(async (client) => {
      const cols = await getTableColumns(client, 'users');
      if (!cols.has('password_hash')) {
        throw new Error('Password change is not supported on this database');
      }

      const r = await client.query(
        `SELECT password_hash FROM users WHERE id = $1 AND is_active = true LIMIT 1`,
        [userId]
      );
      if (!r.rows || r.rows.length === 0) {
        const err = new Error('User not found');
        err.statusCode = 404;
        throw err;
      }
      const passwordHash = r.rows[0].password_hash;
      if (!passwordHash) {
        const err = new Error('Account not configured for password change. Please contact admin.');
        err.statusCode = 400;
        throw err;
      }

      let ok = false;
      try {
        ok = await bcrypt.compare(String(currentPassword || ''), String(passwordHash));
      } catch {
        ok = false;
      }
      if (!ok) {
        const err = new Error('Current password is incorrect');
        err.statusCode = 400;
        throw err;
      }

      const nextHash = await bcrypt.hash(String(newPassword), 10);
      await client.query(
        `UPDATE users SET password_hash = $1 WHERE id = $2 AND is_active = true`,
        [nextHash, userId]
      );
    });

    success(res, 200, 'Password changed successfully', null);
  } catch (err) {
    const statusCode = err?.statusCode || 500;
    const msg =
      statusCode === 500
        ? 'Failed to change password'
        : (err?.message || 'Failed to change password');
    if (statusCode === 500) {
      console.error('ChangePassword error:', err);
    }
    return errorResponse(res, statusCode, msg);
  }
};

module.exports = { login, getMe, updateMe, changePassword, logout };
