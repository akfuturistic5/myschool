/**
 * Aligns "admin-only" master-data behaviour (e.g. include_inactive) with
 * middleware/rbacMiddleware requireRole(ADMIN_ROLE_IDS): same role_id + role_name rules.
 */
const { ROLES, ADMIN_ROLE_IDS, ROLE_NAMES } = require('../config/roles');
const { sanitizeChatText } = require('./htmlSanitize');

const MAX_MASTER_DESCRIPTION_CHARS = 5000;

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
    if (id === ROLES.PARENT) {
      names.add('father');
      names.add('mother');
    }
  });
  return names;
}

/** True if user matches ADMIN_ROLE_IDS by id or by name (Headmaster / Administrative aliases). */
function userCanManageMasterData(req) {
  const user = req.user;
  if (!user) return false;
  const roleId = parseRoleId(user.role_id);
  const roleName = parseRoleName(user.role_name || user.role);
  const normalizedAllowedIds = ADMIN_ROLE_IDS.map((id) => parseRoleId(id)).filter((id) => id != null);
  const allowedRoleNames = allowedRoleNamesFromIds(normalizedAllowedIds);
  const isAllowedById = roleId != null && normalizedAllowedIds.includes(roleId);
  const isAllowedByName = roleName !== '' && allowedRoleNames.has(roleName);
  return isAllowedById || isAllowedByName;
}

/**
 * Sanitize optional description; enforce max length (tenant tables use `text` — bound size for safety).
 * @returns {{ ok: true, value: string | null } | { ok: false, message: string }}
 */
function parseMasterDescription(raw) {
  const s = sanitizeChatText(raw ?? '');
  if (s.length > MAX_MASTER_DESCRIPTION_CHARS) {
    return {
      ok: false,
      message: `description must be ${MAX_MASTER_DESCRIPTION_CHARS} characters or fewer`,
    };
  }
  return { ok: true, value: s ? s : null };
}

module.exports = {
  userCanManageMasterData,
  parseMasterDescription,
  MAX_MASTER_DESCRIPTION_CHARS,
};
