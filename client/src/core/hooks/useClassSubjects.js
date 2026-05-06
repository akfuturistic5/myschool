import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';

export const useClassSubjects = (filters = {}) => {
  const [classSubjects, setClassSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchClassSubjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getClassSubjects(filters);
      
      if (response.status === 'SUCCESS') {
        setClassSubjects(response.data);
      } else {
        setError('Failed to fetch class subjects');
      }
    } catch (err) {
      console.error('Error fetching class subjects:', err);
      setError(err.message || 'Failed to fetch class subjects');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchClassSubjects();
  }, [fetchClassSubjects]);

  return {
    classSubjects,
    loading,
    error,
    refetch: fetchClassSubjects
  };
};
