import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { apiService } from '../services/apiService';
import { selectUser } from '../data/redux/authSlice';

/**
 * Fetches the current logged-in teacher's data (for Teacher role users only).
 * Uses /teachers/me API which returns teacher by user_id from JWT via staff.
 * For Admin/Headmaster and other roles, skips the API call to avoid 404 errors.
 */
export const useCurrentTeacher = () => {
  const user = useSelector(selectUser);
  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const role = (user?.role ?? '').trim().toLowerCase();
  const isTeacherRole = role === 'teacher';

  const fetchCurrentTeacher = async () => {
    if (!isTeacherRole) {
      setTeacher(null);
      setLoading(false);
      setError(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getCurrentTeacher();
      if (response.status === 'SUCCESS' && response.data) {
        setTeacher(response.data);
      } else {
        setTeacher(null);
      }
    } catch (err) {
      console.error('Error fetching current teacher:', err);
      setError(err?.message || 'Failed to fetch teacher');
      setTeacher(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isTeacherRole) {
      setTeacher(null);
      setLoading(false);
      setError(null);
      return;
    }
    fetchCurrentTeacher();
  }, [isTeacherRole]);

  return {
    teacher,
    loading: isTeacherRole ? loading : false,
    error: isTeacherRole ? error : null,
    refetch: fetchCurrentTeacher,
  };
};
