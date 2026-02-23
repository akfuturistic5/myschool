const { query } = require('../config/database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const serverConfig = require('../config/server');
const { success, error: errorResponse } = require('../utils/responseHelper');

/**
 * Login - authenticate user with username/phone and password
 * Uses bcrypt.compare with password_hash column.
 * Backward compat: if password_hash is empty, compares with phone and migrates hash on success.
 * Lookup by username, email, or phone.
 */
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return errorResponse(res, 400, 'Username and password are required');
    }

    if (!serverConfig.jwtSecret) {
      return errorResponse(res, 500, 'Server configuration error');
    }

    const identifier = username.trim().toString();
    const enteredPassword = (password || '').toString().trim();

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
      return errorResponse(res, 401, 'Invalid username or password');
    }

    const user = userResult.rows[0];
    const storedPhone = (user.phone || '').toString().trim();
    const passwordHash = user.password_hash;

    if (!storedPhone && !passwordHash) {
      return errorResponse(res, 401, 'Account not configured for login. Please contact admin.');
    }

    let passwordValid = false;
    if (passwordHash) {
      try {
        passwordValid = await bcrypt.compare(enteredPassword, passwordHash);
      } catch {
        passwordValid = false;
      }
    }
    if (!passwordValid && storedPhone) {
      passwordValid = enteredPassword === storedPhone;
      if (passwordValid) {
        const hash = bcrypt.hashSync(enteredPassword, 10);
        await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, user.id]).catch(() => {});
      }
    }
    if (!passwordValid) {
      return errorResponse(res, 401, 'Invalid username or password');
    }

    const payload = {
      id: user.id,
      username: user.username,
      role_id: user.role_id,
      role_name: user.role_name || 'User'
    };

    const token = jwt.sign(
      payload,
      serverConfig.jwtSecret,
      { expiresIn: serverConfig.jwtExpiresIn || '7d' }
    );

    const displayName = (user.staff_first_name || user.first_name)
      ? `${user.staff_first_name || user.first_name} ${user.staff_last_name || user.last_name}`.trim()
      : user.username;

    success(res, 200, 'Login successful', {
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName,
        role: user.role_name || 'User',
        role_id: user.role_id,
        staff_id: user.staff_id
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    errorResponse(res, 500, 'Login failed');
  }
};

/**
 * Get current user from token
 */
const getMe = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return errorResponse(res, 401, 'Not authenticated');
    }
    success(res, 200, 'User fetched', { user });
  } catch (err) {
    console.error('GetMe error:', err);
    errorResponse(res, 500, 'Failed to fetch user');
  }
};

module.exports = { login, getMe };
