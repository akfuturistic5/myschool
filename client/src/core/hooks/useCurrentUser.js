import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { normalizeAuthRole } from '../utils/roleUtils';

export const useCurrentUser = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCurrentUser = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use /auth/me - works for all roles. Auth via cookie or Bearer token.
      const response = await apiService.getMe();

      if (response.status === 'SUCCESS' && response.data) {
        const userData = response.data;
        
        // Use display_name and display_role from backend, or compute from available fields
        const name = 
          userData.display_name ||
          [userData.student_first_name, userData.student_last_name].filter(Boolean).join(' ') ||
          [userData.staff_first_name, userData.staff_last_name].filter(Boolean).join(' ') ||
          [userData.first_name, userData.last_name].filter(Boolean).join(' ') ||
          userData.username ||
          'User';

        // IMPORTANT: UI authorization/routing must use canonical auth role only.
        // `display_role` / designation can be "Headmaster", "Coordinator", etc.
        // and is for label display, not for permission decisions.
        const role = normalizeAuthRole(userData.role_name, userData.role_id);

        // Keep canonical fields last so payload keys cannot overwrite auth role.
        setUser({
          ...userData,
          id: userData.id,
          name,
          role,
          display_role: userData.display_role || userData.role_name || role,
          account_disabled: userData.account_disabled === true,
        });
      } else {
        setError('Failed to fetch user data');
      }
    } catch (err) {
      console.error('Error fetching current user:', err);
      setError(err.message || 'Failed to fetch current user');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  return {
    user,
    loading,
    error,
    refetch: fetchCurrentUser,
  };
};
