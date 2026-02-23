import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { apiService } from '../services/apiService';
import { selectUser } from '../data/redux/authSlice';

/**
 * Fetches the current logged-in student's data (for Student role users only).
 * For Parent/Guardian/Admin, skips the API call to avoid 404 and console errors.
 */
export const useCurrentStudent = () => {
  const authUser = useSelector(selectUser);
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const role = (authUser?.role || authUser?.display_role || '').toString().toLowerCase();
  const isStudentRole = role === 'student';

  const fetchCurrentStudent = async () => {
    if (!isStudentRole) {
      setStudent(null);
      setError(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getCurrentStudent();
      if (response.status === 'SUCCESS' && response.data) {
        setStudent(response.data);
      } else {
        setStudent(null);
      }
    } catch (err) {
      setError(err?.message || 'Failed to fetch student');
      setStudent(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isStudentRole) {
      setStudent(null);
      setError(null);
      setLoading(false);
      return;
    }
    fetchCurrentStudent();
  }, [isStudentRole]);

  return {
    student,
    loading: isStudentRole ? loading : false,
    error,
    refetch: fetchCurrentStudent,
  };
};
