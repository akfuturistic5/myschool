import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

export const useUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiService.getUsers();

      if (response.status === 'SUCCESS') {
        const transformedData = response.data.map((user, index) => {
          const numericId = user.id != null ? Number(user.id) : null;
          const name =
            `${user.first_name || ''} ${user.last_name || ''}`.trim() ||
            user.name ||
            user.username ||
            'N/A';

          const className = user.class_name || user.class || '—';
          const section = user.section_name || user.section || '—';

          const joinedRaw =
            user.created_at || user.date_of_join || user.date_of_joining;

          const dateOfJoined = joinedRaw
            ? new Date(joinedRaw).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
            : 'N/A';

          const status = user.is_active
            ? 'Active'
            : user.status === 'Active' || user.status === 'Inactive'
            ? user.status
            : 'Active';

          const roleLabel =
            (user.role_name && String(user.role_name).trim()) || '—';

          return {
            key: numericId != null ? String(numericId) : `idx-${index + 1}`,
            /** DB primary key — use for support / links */
            userId: numericId,
            /** Shown in ID column */
            id: numericId != null ? String(numericId) : '—',
            role: roleLabel,
            name,
            class: className,
            section,
            dateOfJoined,
            status,
            originalData: user,
          };
        });

        setUsers(transformedData);
      } else {
        setError('Failed to fetch users data');
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err.message || 'Failed to fetch users data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return {
    users,
    loading,
    error,
    refetch: fetchUsers,
  };
};
