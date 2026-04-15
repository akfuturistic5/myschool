import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService.js';

export const useEmails = (folder = 'inbox') => {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getEmails(folder);
      setEmails(response.data || []);
    } catch (err) {
      console.error('Error fetching emails:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch emails');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, [folder]);

  return {
    emails,
    loading,
    error,
    refetch: fetchEmails,
  };
};
