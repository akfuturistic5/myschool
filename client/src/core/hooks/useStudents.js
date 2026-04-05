import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { apiService } from '../services/apiService.js';
import { selectUser } from '../data/redux/authSlice';
import { selectSelectedAcademicYearId } from '../data/redux/academicYearSlice';
import { isAdministrativeRole, isHeadmasterRole } from '../utils/roleUtils';

export const useStudents = () => {
  const user = useSelector(selectUser);
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStudents = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    const roleId = user.user_role_id ?? user.role_id;
    const roleName = (user.role ?? '').trim().toLowerCase();
    // user_roles: teacher id = 2, student id = 3 (must match server ROLES)
    const isTeacher = roleName === 'teacher' || roleId === 2;
    const canListStudents = isTeacher || isHeadmasterRole(user) || isAdministrativeRole(user);
    if (!canListStudents) {
      setStudents([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      let response;
      if (isTeacher) {
        response = await apiService.getTeacherStudents(academicYearId);
      } else {
        response = await apiService.getStudents(academicYearId);
      }

      const raw = response.data || [];
      const seen = new Set();
      const deduped = raw.filter((s) => {
        const key = s.id ?? s.admission_number ?? JSON.stringify(s);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setStudents(deduped);
    } catch (err) {
      console.error('Error fetching students:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetchStudents();
  }, [user?.id, user?.user_role_id ?? user?.role_id, user?.role, academicYearId]);

  return {
    students,
    loading,
    error,
    refetch: fetchStudents,
  };
};
