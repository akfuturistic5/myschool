import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { apiService } from '../services/apiService';
import { selectUser } from '../data/redux/authSlice';

/** Shape used by student dashboard and details; API may send extra fields. */
export interface CurrentStudent {
  id?: number;
  admission_number?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  class_name?: string | null;
  section_name?: string | null;
  class?: string | null;
  section?: string | null;
  roll_number?: string | null;
  photo_url?: string | null;
  academic_year_id?: number | null;
  gender?: string | null;
  [key: string]: unknown;
}

/**
 * Fetches the current logged-in student's data (for Student role users only).
 * For Parent/Guardian/Admin, skips the API call to avoid 404 and console errors.
 */
export const useCurrentStudent = () => {
  const authUser = useSelector(selectUser);
  const [student, setStudent] = useState<CurrentStudent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const role = (authUser?.role || '').toString().toLowerCase();
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
        const hasUserAvatar = !!String(authUser?.avatar || '').trim();
        const preferredAvatarPath = hasUserAvatar ? authUser.avatar : response.data.photo_url;
        const resolvedAvatarUrl = preferredAvatarPath
          ? await apiService.resolveAvatarUrl(preferredAvatarPath)
          : '';
        setStudent({
          ...(response.data as Record<string, unknown>),
          photo_url: resolvedAvatarUrl || null,
        } as CurrentStudent);
      } else {
        setStudent(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch student');
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
    void fetchCurrentStudent();
  }, [isStudentRole, authUser?.avatar]);

  return {
    student,
    loading: isStudentRole ? loading : false,
    error,
    refetch: fetchCurrentStudent,
  };
};
