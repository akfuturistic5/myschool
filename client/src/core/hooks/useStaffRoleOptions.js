import { useMemo } from 'react';
import { useUserRoles } from './useUserRoles';

/** Login roles that are not assigned via HRM staff add/edit. */
const EXCLUDED_STAFF_ROLE_NAMES = new Set([
  'admin',
  'teacher',
  'student',
  'parent',
  'guardian',
]);

/**
 * Active user roles suitable for HRM staff accounts (administrative, driver, conductor, etc.).
 */
export function useStaffRoleOptions() {
  const { userRoles, loading, error, refetch } = useUserRoles();

  const roleOptions = useMemo(
    () =>
      userRoles
        .filter((row) => {
          const name = String(
            row.originalData?.role_name ?? row.roleName ?? ''
          )
            .trim()
            .toLowerCase();
          return name && !EXCLUDED_STAFF_ROLE_NAMES.has(name);
        })
        .map((row) => ({
          value: String(row.originalData?.id ?? ''),
          label: row.roleName || row.originalData?.role_name || 'N/A',
        }))
        .filter((o) => o.value),
    [userRoles]
  );

  const administrativeRoleId = useMemo(() => {
    const row = userRoles.find((r) => {
      const name = String(r.originalData?.role_name ?? r.roleName ?? '')
        .trim()
        .toLowerCase();
      return name === 'administrative';
    });
    const id = row?.originalData?.id;
    return id != null ? String(id) : null;
  }, [userRoles]);

  const driverRoleId = useMemo(() => {
    const row = userRoles.find((r) => {
      const name = String(r.originalData?.role_name ?? r.roleName ?? '')
        .trim()
        .toLowerCase();
      return name === 'driver';
    });
    const id = row?.originalData?.id;
    return id != null ? String(id) : null;
  }, [userRoles]);

  /** Login role for teaching staff (excluded from dropdown but synced from designation). */
  const teacherRoleId = useMemo(() => {
    const row = userRoles.find((r) => {
      const name = String(r.originalData?.role_name ?? r.roleName ?? '')
        .trim()
        .toLowerCase();
      return name === 'teacher';
    });
    const id = row?.originalData?.id;
    return id != null ? String(id) : null;
  }, [userRoles]);

  return {
    roleOptions,
    administrativeRoleId,
    driverRoleId,
    teacherRoleId,
    loading,
    error,
    refetch,
  };
}
