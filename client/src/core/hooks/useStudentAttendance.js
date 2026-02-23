import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

export function useStudentAttendance(studentId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = async () => {
    if (!studentId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.getStudentAttendance(studentId);
      if (res?.status === 'SUCCESS' && res.data) {
        const payload = res.data;
        const records = Array.isArray(payload?.records) ? payload.records : (Array.isArray(payload) ? payload : []);
        const summary = payload?.summary ?? { present: 0, absent: 0, halfDay: 0, late: 0 };
        setData({ records, summary });
      } else {
        setData(null);
      }
    } catch (err) {
      setError(err?.message || 'Failed to fetch student attendance');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!studentId) {
      setData(null);
      setLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getStudentAttendance(studentId);
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
          setError(err?.message || 'Failed to fetch student attendance');
          setData(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [studentId]);

  return { data, loading, error, refetch };
}
