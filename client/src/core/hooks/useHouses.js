import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService.js';

export const useHouses = () => {
  const [houses, setHouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHouses = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getHouses();
      setHouses(response.data);
    } catch (err) {
      console.error('Error fetching houses:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch houses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHouses();
  }, []);

  return {
    houses,
    loading,
    error,
    refetch: fetchHouses,
  };
};
