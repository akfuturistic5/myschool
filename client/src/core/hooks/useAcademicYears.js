import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService.js';

export const useAcademicYears = () => {
  const [academicYears, setAcademicYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAcademicYears = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getAcademicYears();
      setAcademicYears(response.data);
    } catch (err) {
      console.error('Error fetching academic years:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch academic years');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAcademicYears();
  }, []);

  return {
    academicYears,
    loading,
    error,
    refetch: fetchAcademicYears,
  };
};
