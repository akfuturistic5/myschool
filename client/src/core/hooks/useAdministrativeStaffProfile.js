import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { useCurrentUser } from './useCurrentUser';

/**
 * Loads the logged-in administrative user's linked staff row (GET /staff/:id).
 * Requires staff_id from /auth/me.
 */
export const useAdministrativeStaffProfile = () => {
  const { user, loading: userLoading, error: userError } = useCurrentUser();
  const staffId = user?.staff_id != null ? Number(user.staff_id) : null;
  const [staff, setStaff] = useState(null);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [staffError, setStaffError] = useState(null);

  useEffect(() => {
    if (userLoading) return;
    if (staffId == null || Number.isNaN(staffId)) {
      setStaff(null);
      setStaffError(null);
      setLoadingStaff(false);
      return;
    }
    let cancelled = false;
    setLoadingStaff(true);
    setStaffError(null);
    apiService
      .getStaffById(staffId)
      .then((res) => {
        if (cancelled) return;
        if (res?.status === 'SUCCESS' && res.data) {
          setStaff(res.data);
        } else {
          setStaff(null);
          setStaffError('Could not load your staff profile.');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStaff(null);
          setStaffError('Could not load your staff profile.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingStaff(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userLoading, staffId]);

  const loading = userLoading || loadingStaff;
  const mergedError =
    userError || (staffId == null && !userLoading ? null : staffError);

  return {
    staff,
    staffId,
    user,
    loading,
    error:
      staffId == null && !userLoading
        ? 'Your account is not linked to a staff record. Contact the school office to use profile and leave features.'
        : mergedError,
  };
};
