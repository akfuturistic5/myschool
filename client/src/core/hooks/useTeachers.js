import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService.js';

/**
 * @param {{ skip?: boolean }} [options] - When true, does not call GET /teachers (e.g. teacher portal users lack that permission).
 */
export const useTeachers = (options = {}) => {
  const { skip = false } = options;
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState(null);

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getTeachers();
      const raw = response?.data;
      const list = Array.isArray(raw) ? raw : Array.isArray(response) ? response : [];
      setTeachers(list);
    } catch (err) {
      console.error('Error fetching teachers:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch teachers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (skip) {
      setTeachers([]);
      setLoading(false);
      setError(null);
      return;
    }
    fetchTeachers();
  }, [skip]);

  return {
    teachers,
    loading,
    error,
    refetch: fetchTeachers,
  };
};
