/**
 * Role-based access control middleware
 * Use after authenticate/protectApi - req.user must have role_id
 */
const { error: errorResponse } = require('../utils/responseHelper');
const { ROLES, ROLE_NAMES } = require('../config/roles');

function parseRoleId(value) {
  const roleId = value != null ? parseInt(value, 10) : null;
  return Number.isInteger(roleId) ? roleId : null;
}

function parseRoleName(value) {
  return String(value || '').trim().toLowerCase();
}

function allowedRoleNamesFromIds(roleIds) {
  const names = new Set();
  roleIds.forEach((id) => {
    const canonicalName = ROLE_NAMES[id];
    if (canonicalName) names.add(parseRoleName(canonicalName));
    if (id === ROLES.ADMIN) {
      names.add('headmaster');
      names.add('administrator');
    }
  });
  return names;
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
    const roleName = parseRoleName(user.role_name || user.role);
    if (!Array.isArray(allowedRoleIds)) {
      return errorResponse(res, 403, 'Access denied. Insufficient permissions.');
    }
    const normalizedAllowedIds = allowedRoleIds
      .map((id) => parseRoleId(id))
      .filter((id) => id != null);
    const allowedRoleNames = allowedRoleNamesFromIds(normalizedAllowedIds);
    const isAllowedById = roleId != null && normalizedAllowedIds.includes(roleId);
    const isAllowedByName = roleName !== '' && allowedRoleNames.has(roleName);
    if (!isAllowedById && !isAllowedByName) {
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
    const isAllowedByName = normalized.includes(roleName);
    if (!isAllowedByName) {
      return errorResponse(res, 403, 'Access denied. Insufficient permissions.');
    }
    next();
  };
};

module.exports = { requireRole, requireRoleName };
