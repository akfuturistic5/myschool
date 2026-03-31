/**
 * Role-based access control middleware
 * Use after authenticate/protectApi - req.user must have role_id
 */
const { error: errorResponse } = require('../utils/responseHelper');
const { ROLES, ADMIN_ROLE_IDS, ADMIN_ROLE_NAMES } = require('../config/roles');

function parseRoleId(value) {
  const roleId = value != null ? parseInt(value, 10) : null;
  return Number.isInteger(roleId) ? roleId : null;
}

function parseRoleName(value) {
  return String(value || '').trim().toLowerCase();
}

function isAdminEquivalentUser(user) {
  const roleId = parseRoleId(user?.role_id);
  const roleName = parseRoleName(user?.role_name);
  return (
    (roleId != null && ADMIN_ROLE_IDS.includes(roleId)) ||
    (roleName !== '' && ADMIN_ROLE_NAMES.includes(roleName))
  );
}

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
    const roleId = parseRoleId(user.role_id);
    if (!Array.isArray(allowedRoleIds)) {
      return errorResponse(res, 403, 'Access denied. Insufficient permissions.');
    }
    const normalizedAllowedIds = allowedRoleIds
      .map((id) => parseRoleId(id))
      .filter((id) => id != null);
    const allowsAdminEquivalent =
      normalizedAllowedIds.includes(ROLES.ADMIN) || normalizedAllowedIds.includes(ROLES.ADMINISTRATIVE);
    const isAllowedById = roleId != null && normalizedAllowedIds.includes(roleId);
    const isAllowedByAdminAlias = allowsAdminEquivalent && isAdminEquivalentUser(user);
    if (!isAllowedById && !isAllowedByAdminAlias) {
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
    const roleName = parseRoleName(user.role_name);
    if (!roleName) {
      return errorResponse(res, 403, 'Access denied. Insufficient permissions.');
    }
    const allowsAdminEquivalent = normalized.includes('admin');
    const isAllowedByName = normalized.includes(roleName);
    const isAllowedByAdminAlias = allowsAdminEquivalent && isAdminEquivalentUser(user);
    if (!isAllowedByName && !isAllowedByAdminAlias) {
      return errorResponse(res, 403, 'Access denied. Insufficient permissions.');
    }
    next();
  };
};

module.exports = { requireRole, requireRoleName };
