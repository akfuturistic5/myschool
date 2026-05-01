import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

export interface StudentAttendanceRecord {
  attendanceDate?: string;
  status?: string;
  [key: string]: unknown;
}

export interface StudentAttendanceData {
  records: StudentAttendanceRecord[];
  summary: {
    present: number;
    absent: number;
    halfDay: number;
    late: number;
  };
}

export function useStudentAttendance(studentId: number | null) {
  const [data, setData] = useState<StudentAttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = async () => {
    if (!studentId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.getStudentAttendance(studentId);
      if (res?.status === 'SUCCESS' && res.data) {
        const payload = res.data as { records?: unknown; summary?: StudentAttendanceData['summary'] } | unknown[];
        const records = Array.isArray((payload as { records?: unknown })?.records)
          ? (payload as { records: StudentAttendanceRecord[] }).records
          : Array.isArray(payload)
            ? (payload as StudentAttendanceRecord[])
            : [];
        const summary =
          (payload as { summary?: StudentAttendanceData['summary'] })?.summary ??
          ({ present: 0, absent: 0, halfDay: 0, late: 0 } as StudentAttendanceData['summary']);
        setData({ records, summary });
      } else {
        setData(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch student attendance');
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
    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getStudentAttendance(studentId);
        if (mounted && res?.status === 'SUCCESS' && res.data) {
          const payload = res.data as { records?: unknown; summary?: StudentAttendanceData['summary'] } | unknown[];
          const records = Array.isArray((payload as { records?: unknown })?.records)
            ? (payload as { records: StudentAttendanceRecord[] }).records
            : Array.isArray(payload)
              ? (payload as StudentAttendanceRecord[])
              : [];
          const summary =
            (payload as { summary?: StudentAttendanceData['summary'] })?.summary ??
            ({ present: 0, absent: 0, halfDay: 0, late: 0 } as StudentAttendanceData['summary']);
          setData({ records, summary });
        } else if (mounted) {
          setData(null);
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch student attendance');
          setData(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [studentId]);

  return { data, loading, error, refetch };
}
