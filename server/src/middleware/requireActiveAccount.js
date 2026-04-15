const { query } = require('../config/database');
const { error: errorResponse } = require('../utils/responseHelper');

/**
 * Block API access for inactive student/teacher accounts.
 * Must run after protectApi (so req.user is set).
 * Skips /auth/me so disabled users can still get their profile and account_disabled flag.
 */
const requireActiveAccount = async (req, res, next) => {
  if (!req.user || !req.user.id) {
    return next();
  }
  const path = (req.originalUrl || req.path || '').replace(/\?.*$/, '');
  if (path.includes('/auth/me') || path.includes('/auth/login')) {
    return next();
  }
  try {
    const result = await query(
      `SELECT s.id AS student_id, s.is_active AS student_is_active,
              st.id AS staff_id, st.is_active AS staff_is_active
       FROM users u
       LEFT JOIN students s ON u.id = s.user_id
       LEFT JOIN staff st ON u.id = st.user_id
       WHERE u.id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) return next();
    const r = result.rows[0];
    const studentInactive = r.student_id != null && (r.student_is_active === false || r.student_is_active === 'f' || r.student_is_active === 0);
    const staffInactive = r.staff_id != null && (r.staff_is_active === false || r.staff_is_active === 'f' || r.staff_is_active === 0);
    if (studentInactive || staffInactive) {
      return errorResponse(res, 403, 'Your account is disabled by headmaster. Kindly contact school headmaster for browsing application.');
    }
  } catch (err) {
    console.error('requireActiveAccount error:', err);
    return errorResponse(res, 503, 'Unable to validate account status');
  }
  next();
};

module.exports = { requireActiveAccount };
