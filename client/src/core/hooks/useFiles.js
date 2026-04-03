import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService.js';

export const useFiles = (params = {}) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getFiles(params);
      setFiles(response.data || []);
    } catch (err) {
      console.error('Error fetching files:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [JSON.stringify(params)]);

  return {
    files,
    loading,
    error,
    refetch: fetchFiles,
  };
};
