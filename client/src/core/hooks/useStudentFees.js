import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

export function useStudentFees(studentId, academicYearId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = async () => {
    if (!studentId || !academicYearId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.getStudentFeeDetailedStatus(studentId, academicYearId);
      if (res?.status === 'SUCCESS' && res.data) {
        setData(res.data);
      } else {
        setData(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch student fees');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!studentId || !academicYearId) {
      setData(null);
      setLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getStudentFeeDetailedStatus(studentId, academicYearId);
        if (mounted && res?.status === 'SUCCESS' && res.data) {
          setData(res.data);
        } else if (mounted) {
          setData(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || 'Failed to fetch student fees');
          setData(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [studentId, academicYearId]);

  return { data, loading, error, refetch };
}
