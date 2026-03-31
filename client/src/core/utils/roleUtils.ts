/**
 * Role-based routing utilities
 * Maps user_roles.role_name from DB to dashboard routes
 */

import { all_routes } from '../../feature-module/router/all_routes';

export type UserRole = 'Admin' | 'Teacher' | 'Student' | 'Parent' | 'Guardian';

const ADMIN_ROLE_ALIASES = new Set([
  'admin',
  'headmaster',
  'administrative',
  'administrator',
]);

function normalizeRole(role: string | undefined | null): string {
  return (role || '').trim().toLowerCase();
}

function isAdminLikeRole(role: string | undefined | null): boolean {
  return ADMIN_ROLE_ALIASES.has(normalizeRole(role));
}

/**
 * Get dashboard route for a given role
 * role_name comes from user_roles table (case-sensitive: Admin, Student, Teacher, Parent, Guardian)
 */
export function getDashboardForRole(role: string | undefined | null): string {
  if (!role) return all_routes.adminDashboard;
  const normalized = normalizeRole(role);
  if (isAdminLikeRole(normalized)) {
    return all_routes.adminDashboard;
  }
  switch (normalized) {
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
  const normalized = normalizeRole(role);
  if (isAdminLikeRole(normalized)) return 'Preskool Headmaster';
  switch (normalized) {
    case 'teacher':
      return "Preskool Teacher";
    case 'student':
      return "Preskool Student";
    case 'parent':
      return "Preskool's Child Parent";
    case 'guardian':
      return "Preskool's Child Guardian";
    default:
      // Backend may send designation e.g. "Class Teacher", "Science Teacher" as display_role
      if (normalized.includes('teacher')) return "Preskool Teacher";
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
  const normalized = normalizeRole(role);

  const roleLabel = (() => {
    if (isAdminLikeRole(normalized)) return 'Headmaster';
    switch (normalized) {
      case 'teacher':
        return 'Teacher';
      case 'student':
        return 'Student';
      case 'parent':
        return 'Parent';
      case 'guardian':
        return 'Guardian';
      default:
        if (normalized.includes('teacher')) return 'Teacher';
        if (normalized.includes('head')) return 'Headmaster';
        return role?.trim() || 'User';
    }
  })();

  if (!safeSchool) return `Preskool ${roleLabel}`.trim();
  return `${safeSchool}'s ${roleLabel}`;
}

/**
 * Path prefixes restricted to Admin only (backend USER_MANAGER_ROLES).
 * Add more prefixes as needed to align with backend RBAC.
 */
const ADMIN_ONLY_PATH_PREFIXES = [
  '/user-management/',
];

/**
 * Check if user with given role can access the given path.
 * Used for frontend route protection to match backend RBAC.
 */
export function canAccessPath(path: string, role: string | undefined | null): boolean {
  const userDashboard = getDashboardForRole(role);
  const dashboardPaths = [
    all_routes.adminDashboard,
    all_routes.teacherDashboard,
    all_routes.studentDashboard,
    all_routes.parentDashboard,
    all_routes.guardianDashboard,
  ];
  if (dashboardPaths.includes(path)) {
    return path === userDashboard;
  }
  // Admin-only paths: only Admin role can access
  const isAdmin = isAdminLikeRole(role);
  if (ADMIN_ONLY_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return isAdmin;
  }
  return true;
}
