import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

export interface StudentExamSubjectRow {
  subjectName?: string;
  [key: string]: unknown;
}

export interface StudentExamRow {
  examId?: number;
  examName?: string;
  examLabel?: string;
  subjects?: StudentExamSubjectRow[];
  summary?: {
    percentage?: number;
    overallResult?: string;
  };
  [key: string]: unknown;
}

export interface StudentExamResultsData {
  exams: StudentExamRow[];
}

export function useStudentExamResults(studentId: number | null) {
  const [data, setData] = useState<StudentExamResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = async () => {
    if (!studentId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.getStudentExamResults(studentId);
      if (res?.status === 'SUCCESS' && res.data) {
        setData(res.data as StudentExamResultsData);
      } else {
        setData({ exams: [] });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch exam results');
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
    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getStudentExamResults(studentId);
        if (mounted && res?.status === 'SUCCESS' && res.data) {
          setData(res.data as StudentExamResultsData);
        } else if (mounted) {
          setData({ exams: [] });
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch exam results');
          setData({ exams: [] });
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
