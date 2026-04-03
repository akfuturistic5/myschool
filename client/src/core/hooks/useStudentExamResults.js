import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

export function useStudentExamResults(studentId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = async () => {
    if (!studentId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.getStudentExamResults(studentId);
      if (res?.status === 'SUCCESS' && res.data) {
        setData(res.data);
      } else {
        setData({ exams: [] });
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch exam results');
      setData({ exams: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!studentId) {
      setData({ exams: [] });
      setLoading(false);
      setError(null);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getStudentExamResults(studentId);
        if (mounted && res?.status === 'SUCCESS' && res.data) {
          setData(res.data);
        } else if (mounted) {
          setData({ exams: [] });
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || 'Failed to fetch exam results');
          setData({ exams: [] });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [studentId]);

  return { data, loading, error, refetch };
}
