import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';

export const useDepartments = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchDepartments = useCallback(async (options = {}) => {
    const silent = options.silent === true;
    try {
      if (silent) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await apiService.getDepartments();

      if (response.status === 'SUCCESS') {
        const transformedData = response.data.map((dept, index) => {
          const numericId =
            dept.id != null ? String(dept.id) : String(index + 1);

          const departmentName =
            dept.department_name ||
            dept.department ||
            dept.name ||
            'N/A';

          const codeRaw = dept.department_code;
          const departmentCode =
            codeRaw != null && String(codeRaw).trim() !== ''
              ? String(codeRaw).trim()
              : '—';

          const hodRaw = dept.head_of_department_name;
          const headOfDepartment =
            hodRaw != null && String(hodRaw).trim() !== ''
              ? String(hodRaw).trim()
              : '—';

          const status =
            dept.is_active === true
              ? 'Active'
              : dept.is_active === false
              ? 'Inactive'
              : (dept.status === 'Active' || dept.status === 'Inactive')
              ? dept.status
              : 'Active';

          return {
            key: dept.id != null ? String(dept.id) : String(index + 1),
            id: numericId,
            department: departmentName,
            departmentCode,
            headOfDepartment,
            status,
            originalData: dept, // Store original data for edit modal
          };
        });

        setDepartments(transformedData);
      } else {
        setError('Failed to fetch departments data');
      }
    } catch (err) {
      console.error('Error fetching departments:', err);
      setError(err.message || 'Failed to fetch departments data');
    } finally {
      if (silent) {
        setIsRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  return {
    departments,
    loading,
    isRefreshing,
    error,
    refetch: () => fetchDepartments({ silent: true }),
  };
};
