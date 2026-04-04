/**
 * Role-based routing utilities
 * Maps user_roles.role_name from DB to dashboard routes
 */

import { all_routes } from '../../feature-module/router/all_routes';

type RoleInput =
  | string
  | undefined
  | null
  | {
      role?: string;
      role_id?: number;
      user_role_id?: number;
    };

export type UserRole = 'Admin' | 'Administrative' | 'Teacher' | 'Student' | 'Parent' | 'Guardian';

const HEADMASTER_ROLE_NAMES = new Set(['admin', 'headmaster', 'administrator']);
const ADMINISTRATIVE_ROLE_NAMES = new Set(['administrative']);
const HEADMASTER_ROLE_IDS = new Set([1]);
const ADMINISTRATIVE_ROLE_IDS = new Set([6]);

const ADMINISTRATIVE_ALLOWED_PATH_PREFIXES = [
  '/administrative/',
  '/student/',
  '/teacher/',
  '/parent/',
  '/academic/',
  '/management/',
  '/hrm/',
  '/accounts/',
  '/announcements/',
  '/report/',
  '/application/',
  '/support/',
];

const ADMINISTRATIVE_ALLOWED_EXACT_PATHS = new Set([
  all_routes.administrativeDashboard,
  all_routes.bonafideGenerator,
  all_routes.chat,
  all_routes.callHistory,
  all_routes.calendar,
  all_routes.email,
  all_routes.todo,
  all_routes.notes,
  all_routes.fileManager,
  all_routes.profile,
]);

const ADMINISTRATIVE_BLOCKED_EXACT_PATHS = new Set([all_routes.approveRequest]);

type RoleScope = 'headmaster' | 'administrative' | 'teacher' | 'student' | 'parent' | 'guardian' | 'unknown';

function getRoleParts(role: RoleInput, explicitRoleId?: number | null): { roleName: string; roleId: number | null } {
  if (role && typeof role === 'object') {
    const roleId = Number(role.user_role_id ?? role.role_id);
    return {
      roleName: String(role.role ?? '').trim().toLowerCase(),
      roleId: Number.isFinite(roleId) ? roleId : null,
    };
  }

  const fallbackRoleId = Number(explicitRoleId);
  return {
    roleName: String(role || '').trim().toLowerCase(),
    roleId: Number.isFinite(fallbackRoleId) ? fallbackRoleId : null,
  };
}

function getRoleScope(role: RoleInput, explicitRoleId?: number | null): RoleScope {
  const { roleName, roleId } = getRoleParts(role, explicitRoleId);

  if ((roleId != null && ADMINISTRATIVE_ROLE_IDS.has(roleId)) || ADMINISTRATIVE_ROLE_NAMES.has(roleName)) {
    return 'administrative';
  }

  if ((roleId != null && HEADMASTER_ROLE_IDS.has(roleId)) || HEADMASTER_ROLE_NAMES.has(roleName)) {
    return 'headmaster';
  }

  switch (roleName) {
    case 'teacher':
      return 'teacher';
    case 'student':
      return 'student';
    case 'parent':
      return 'parent';
    case 'guardian':
      return 'guardian';
    default:
      return 'unknown';
  }
}

export function isHeadmasterRole(role: RoleInput, explicitRoleId?: number | null): boolean {
  return getRoleScope(role, explicitRoleId) === 'headmaster';
}

export function isAdministrativeRole(role: RoleInput, explicitRoleId?: number | null): boolean {
  return getRoleScope(role, explicitRoleId) === 'administrative';
}

export function getDisplayRoleLabel(role: RoleInput, explicitRoleId?: number | null): string {
  switch (getRoleScope(role, explicitRoleId)) {
    case 'headmaster':
      return 'Headmaster';
    case 'administrative':
      return 'Administrative';
    case 'teacher':
      return 'Teacher';
    case 'student':
      return 'Student';
    case 'parent':
      return 'Parent';
    case 'guardian':
      return 'Guardian';
    default: {
      const { roleName } = getRoleParts(role, explicitRoleId);
      return roleName ? roleName.charAt(0).toUpperCase() + roleName.slice(1) : 'User';
    }
  }
}

/**
 * Get dashboard route for a given role
 * role_name / role_id comes from auth payload
 */
export function getDashboardForRole(role: RoleInput, explicitRoleId?: number | null): string {
  const scope = getRoleScope(role, explicitRoleId);
  if (!role) return all_routes.adminDashboard;
  switch (scope) {
    case 'headmaster':
      return all_routes.adminDashboard;
    case 'administrative':
      return all_routes.administrativeDashboard;
    case 'teacher':
      return all_routes.teacherDashboard;
    case 'student':
      return all_routes.studentDashboard;
    case 'parent':
      return all_routes.parentDashboard;
    case 'guardian':
      return all_routes.guardianDashboard;
    default:
      return all_routes.adminDashboard;
  }
}

/**
 * Get browser tab title for the given role (for document.title).
 * Used in main layout so tab shows role-specific title instead of generic "Preskool Admin Template".
 */
export function getPageTitleForRole(role: string | undefined | null): string {
  if (!role || typeof role !== 'string') return 'Preskool';
  switch (getRoleScope(role)) {
    case 'headmaster':
      return 'Preskool Headmaster';
    case 'administrative':
      return 'Preskool Administrative';
    case 'teacher':
      return "Preskool Teacher";
    case 'student':
      return "Preskool Student";
    case 'parent':
      return "Preskool's Child Parent";
    case 'guardian':
      return "Preskool's Child Guardian";
    default:
      if (String(role).trim().toLowerCase().includes('teacher')) return "Preskool Teacher";
      return 'Preskool';
  }
}

/**
 * Get browser tab title for the logged-in school + role.
 * Example outputs:
 * - "Millat's Student"
 * - "Iqra's Teacher"
 * - "Anglo's Headmaster"
 */
export function getTabTitleForSchoolRole(
  schoolName: string | undefined | null,
  role: string | undefined | null
): string {
  const safeSchool = (schoolName ?? '').trim();
  const roleLabel = getDisplayRoleLabel(role);

  if (!safeSchool) return `Preskool ${roleLabel}`.trim();
  return `${safeSchool}'s ${roleLabel}`;
}

/**
 * Path prefixes restricted to Admin only (backend USER_MANAGER_ROLES).
 * Add more prefixes as needed to align with backend RBAC.
 */
const ADMIN_ONLY_PATH_PREFIXES = [
  '/user-management/',
  '/general-settings/',
  '/website-settings/',
  '/system-settings/',
  '/financial-settings/',
  '/academic-settings/',
  '/other-settings/',
  '/content/',
];

/**
 * Check if user with given role can access the given path.
 * Used for frontend route protection to match backend RBAC.
 */
export function canAccessPath(path: string, role: RoleInput, explicitRoleId?: number | null): boolean {
  const userDashboard = getDashboardForRole(role, explicitRoleId);
  const dashboardPaths = [
    all_routes.adminDashboard,
    all_routes.administrativeDashboard,
    all_routes.teacherDashboard,
    all_routes.studentDashboard,
    all_routes.parentDashboard,
    all_routes.guardianDashboard,
  ];
  if (dashboardPaths.includes(path)) {
    return path === userDashboard;
  }

  /** Academic Years module: Headmaster + Administrative only (not teachers/students/parents). */
  const academicYearsBase = all_routes.academicYears;
  if (
    academicYearsBase &&
    (path === academicYearsBase || path.startsWith(`${academicYearsBase}/`))
  ) {
    return isHeadmasterRole(role, explicitRoleId) || isAdministrativeRole(role, explicitRoleId);
  }

  if (isHeadmasterRole(role, explicitRoleId)) {
    return true;
  }

  if (isAdministrativeRole(role, explicitRoleId)) {
    if (ADMINISTRATIVE_BLOCKED_EXACT_PATHS.has(path)) return false;
    if (ADMIN_ONLY_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) return false;
    if (ADMINISTRATIVE_ALLOWED_EXACT_PATHS.has(path)) return true;
    return ADMINISTRATIVE_ALLOWED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
  }

  if (ADMIN_ONLY_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return false;
  }
  return true;
}
