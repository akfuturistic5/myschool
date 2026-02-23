/**
 * Role-based access control middleware
 * Use after authenticate/protectApi - req.user must have role_id
 */
const { error: errorResponse } = require('../utils/responseHelper');

/**
 * Require user to have one of the allowed role IDs
 * @param {number[]} allowedRoleIds - e.g. [1] for Admin only
 */
const requireRole = (allowedRoleIds) => {
  return (req, res, next) => {
    const user = req.user;
    if (!user) {
      return errorResponse(res, 401, 'Not authenticated');
    }
    const roleId = user.role_id != null ? parseInt(user.role_id, 10) : null;
    if (roleId == null || !Array.isArray(allowedRoleIds) || !allowedRoleIds.includes(roleId)) {
      return errorResponse(res, 403, 'Access denied. Insufficient permissions.');
    }
    next();
  };
};

/**
 * Require user to have one of the allowed roles (by name, case-insensitive)
 * @param {string[]} allowedRoleNames - e.g. ['Admin', 'Teacher']
 */
const requireRoleName = (allowedRoleNames) => {
  const normalized = (allowedRoleNames || []).map((n) => String(n).toLowerCase());
  return (req, res, next) => {
    const user = req.user;
    if (!user) {
      return errorResponse(res, 401, 'Not authenticated');
    }
    const roleName = (user.role_name || '').toLowerCase();
    if (!roleName || !normalized.includes(roleName)) {
      return errorResponse(res, 403, 'Access denied. Insufficient permissions.');
    }
    next();
  };
};

module.exports = { requireRole, requireRoleName };
