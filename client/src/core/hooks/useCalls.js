import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService.js';

export const useCalls = () => {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCalls = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getCalls();
      setCalls(response.data || []);
    } catch (err) {
      console.error('Error fetching calls:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch calls');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, []);

  return {
    calls,
    loading,
    error,
    refetch: fetchCalls,
  };
};
