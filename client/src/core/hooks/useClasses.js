import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService.js';

export const useClasses = (academicYearId = null) => {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      setError(null);

      let response;
      if (academicYearId) {
        response = await apiService.getClassesByAcademicYear(academicYearId);
      } else {
        response = await apiService.getClasses();
      }

      // Handle both { data: [...] } and direct array (for different API shapes)
      const raw = response?.data ?? (Array.isArray(response) ? response : null);
      setClasses(Array.isArray(raw) ? raw : []);
    } catch (err) {
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
