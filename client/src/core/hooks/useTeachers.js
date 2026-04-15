import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService.js';

export const useTeachers = () => {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getTeachers();
      setTeachers(response.data || []);
    } catch (err) {
      console.error('Error fetching teachers:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch teachers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  return {
    teachers,
    loading,
    error,
    refetch: fetchTeachers,
  };
};
