
import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService.js';

export const useClasses = (academicYearId?: number | string | null) => {
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      setError(null);

      // classes are no longer scoped by academic year (Master Entities)
      const response = await apiService.getClasses();

      // Handle both { data: [...] } and direct array (for different API shapes)
      const raw = response?.data ?? (Array.isArray(response) ? response : null);
      setClasses(Array.isArray(raw) ? raw : []);
    } catch (err: any) {
      console.error('Error fetching classes:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch classes');
      setClasses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, [academicYearId]);

  return {
    classes,
    loading,
    error,
    refetch: fetchClasses,
  };
};
