import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService.js';

export const useNotes = (params = {}) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getNotes(params);
      setNotes(response.data || []);
    } catch (err) {
      console.error('Error fetching notes:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch notes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [JSON.stringify(params)]);

  return {
    notes,
    loading,
    error,
    refetch: fetchNotes,
  };
};
