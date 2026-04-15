
import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService.js';

export const useSections = (classId = null) => {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSections = async () => {
    try {
      setLoading(true);
      setError(null);

      let response;
      if (classId) {
        response = await apiService.getSectionsByClass(classId);
      } else {
        response = await apiService.getSections();
      }

      // Handle both { data: [...] } and direct array (for different API shapes)
      const raw = response?.data ?? (Array.isArray(response) ? response : null);
      setSections(Array.isArray(raw) ? raw : []);
    } catch (err) {
      console.error('Error fetching sections:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch sections');
      setSections([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSections();
  }, [classId]);

  return {
    sections,
    loading,
    error,
    refetch: fetchSections,
  };
};
