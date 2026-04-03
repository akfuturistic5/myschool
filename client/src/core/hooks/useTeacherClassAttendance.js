import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

/**
 * Fetches attendance for students in teacher's classes (Teacher Dashboard).
 * Reuses same data shape as useStudentAttendance for UI consistency.
 * @param {number|null} teacherId - Teacher ID (from useCurrentTeacher)
 * @param {{ days?: number; offset?: number }} options - days (7=This Week, 30=Last Month), offset (7=Last Week only)
 */
export function useTeacherClassAttendance(teacherId, options = {}) {
  const { days, offset, academicYearId } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = async () => {
    if (!teacherId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.getTeacherClassAttendance(teacherId, { days, offset, academicYearId });
      if (res?.status === 'SUCCESS' && res.data) {
        const payload = res.data;
        const records = Array.isArray(payload?.records) ? payload.records : (Array.isArray(payload) ? payload : []);
        const summary = payload?.summary ?? { present: 0, absent: 0, halfDay: 0, late: 0 };
        setData({ records, summary });
      } else {
        setData(null);
      }
    } catch (err) {
      setError(err?.message || 'Failed to fetch attendance');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!teacherId) {
      setData(null);
      setLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getTeacherClassAttendance(teacherId, { days, offset, academicYearId });
        if (mounted && res?.status === 'SUCCESS' && res.data) {
          const payload = res.data;
          const records = Array.isArray(payload?.records) ? payload.records : (Array.isArray(payload) ? payload : []);
          const summary = payload?.summary ?? { present: 0, absent: 0, halfDay: 0, late: 0 };
          setData({ records, summary });
        } else if (mounted) {
          setData(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err?.message || 'Failed to fetch attendance');
          setData(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [teacherId, days, offset, academicYearId]);

  return { data, loading, error, refetch };
}
