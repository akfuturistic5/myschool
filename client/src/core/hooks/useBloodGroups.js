import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService.js';

export const useBloodGroups = () => {
  const [bloodGroups, setBloodGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBloodGroups = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getBloodGroups();
      setBloodGroups(response.data);
    } catch (err) {
      console.error('Error fetching blood groups:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch blood groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBloodGroups();
  }, []);

  return {
    bloodGroups,
    loading,
    error,
    refetch: fetchBloodGroups,
  };
};
