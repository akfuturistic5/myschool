import { isAdministrativeRole, isHeadmasterRole } from "../../../core/utils/roleUtils";

/**
 * Matches server PEOPLE_MANAGER_ROLES (Admin + Administrative) for staff directory
 * list/create/update/delete. Keep in sync with server/src/config/roles.js.
 */
export function canManageStaffDirectory(
  user: { role?: string; user_role_id?: number; role_id?: number } | null | undefined
): boolean {
  if (!user) return false;
  return isHeadmasterRole(user) || isAdministrativeRole(user);
}
