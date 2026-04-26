import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

export interface StudentFeesData {
  totalDue?: number;
  totalPaid?: number;
  totalOutstanding?: number;
  [key: string]: unknown;
}

export function useStudentFees(studentId: number | null, academicYearId?: number | null) {
  const [data, setData] = useState<StudentFeesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = async () => {
    if (!studentId || !academicYearId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.getStudentFeeDetailedStatus(studentId, academicYearId);
      if (res?.status === 'SUCCESS' && res.data) {
        setData(res.data as StudentFeesData);
      } else {
        setData(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch student fees');
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
    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getStudentFeeDetailedStatus(studentId, academicYearId);
        if (mounted && res?.status === 'SUCCESS' && res.data) {
          setData(res.data as StudentFeesData);
        } else if (mounted) {
          setData(null);
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch student fees');
          setData(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [studentId, academicYearId]);

  return { data, loading, error, refetch };
}
