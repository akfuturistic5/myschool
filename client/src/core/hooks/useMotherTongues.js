import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService.js';

export const useMotherTongues = () => {
  const [motherTongues, setMotherTongues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMotherTongues = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getMotherTongues();
      setMotherTongues(response.data);
    } catch (err) {
      console.error('Error fetching mother tongues:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch mother tongues');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMotherTongues();
  }, []);

  return {
    motherTongues,
    loading,
    error,
    refetch: fetchMotherTongues,
  };
};
