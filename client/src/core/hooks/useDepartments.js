import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

export const useDepartments = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiService.getDepartments();

      if (response.status === 'SUCCESS') {
        const transformedData = response.data.map((dept, index) => {
          const id =
            dept.department_code ||
            (dept.id != null ? `D${dept.id}` : `D${index + 1}`);

          const departmentName =
            dept.department_name ||
            dept.department ||
            dept.name ||
            'N/A';

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
            id,
            department: departmentName,
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
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  return {
    departments,
    loading,
    error,
    refetch: fetchDepartments,
  };
};
