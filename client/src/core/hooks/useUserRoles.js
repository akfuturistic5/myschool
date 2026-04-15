import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

export const useUserRoles = () => {
  const [userRoles, setUserRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUserRoles = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiService.getUserRoles();

      if (response.status === 'SUCCESS') {
        const transformedData = response.data.map((role, index) => {
          const roleName =
            role.role_name ||
            role.roleName ||
            role.name ||
            'N/A';

          const createdRaw = role.created_at || role.createdOn;

          const createdOn = createdRaw
            ? new Date(createdRaw).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
            : 'N/A';

          return {
            key: role.id != null ? String(role.id) : String(index + 1),
            roleName,
            createdOn,
            originalData: role, // Store original data for edit modal
          };
        });

        setUserRoles(transformedData);
      } else {
        setError('Failed to fetch user roles data');
      }
    } catch (err) {
      console.error('Error fetching user roles:', err);
      setError(err.message || 'Failed to fetch user roles data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserRoles();
  }, []);

  return {
    userRoles,
    loading,
    error,
    refetch: fetchUserRoles,
  };
};
