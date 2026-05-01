import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';

/**
 * @param {{ enabled?: boolean }} [options]
 * When enabled is false, does not call the list API (for users without PEOPLE_MANAGER access).
 */
export const useStaff = (options = {}) => {
  const { enabled = true } = options;

  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiService.getStaff();

      if (response.status === 'SUCCESS') {
        const transformedData = await Promise.all(response.data.map(async (staff, index) => {
          const displayId =
            staff.employee_code ||
            (staff.id != null ? String(staff.id) : `S${index + 1}`);

          const name = `${staff.first_name || ''} ${staff.last_name || ''}`
            .trim() || 'N/A';

          // Department name from JOIN (department_name or department)
          const department =
            staff.department_name ||
            staff.department ||
            staff.dept_name ||
            'N/A';

          // Designation name from JOIN (designation_name or designation)
          const designation =
            staff.designation_name ||
            staff.designation ||
            staff.title ||
            'N/A';

          const phone = staff.phone || 'N/A';
          const email = staff.email || 'N/A';

          const joiningRaw =
            staff.joining_date || staff.date_of_join || staff.date_of_joining;

          const dateOfJoin = joiningRaw
            ? new Date(joiningRaw).toLocaleDateString('en-GB')
            : 'N/A';

          const rawImg = staff.photo_url || staff.profile_image || '';
          const resolvedImg = rawImg ? await apiService.resolveAvatarUrl(rawImg) : '';
          const img = resolvedImg || 'assets/img/profiles/avatar-27.jpg';

          const dbId =
            staff.id != null && !Number.isNaN(Number(staff.id))
              ? Number(staff.id)
              : null;

          return {
            key: staff.id != null ? String(staff.id) : String(index + 1),
            /** Shown in ID column (employee code preferred) */
            id: displayId,
            /** Primary key for APIs and navigation — always numeric when present */
            dbId,
            name,
            department,
            designation,
            phone,
            email,
            dateOfJoin,
            img,
            originalData: staff,
          };
        }));

        setStaffList(transformedData);
      } else {
        setError('Failed to fetch staff data');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch staff data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setError(null);
      setStaffList([]);
      return;
    }
    fetchStaff();
  }, [enabled, fetchStaff]);

  return {
    staffList,
    loading,
    error,
    refetch: fetchStaff,
  };
};

