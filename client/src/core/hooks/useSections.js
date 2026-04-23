
import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService.js';

export const useSections = (classId = null, options = {}) => {
  const fetchAllWhenNoClass = options.fetchAllWhenNoClass !== false;
  const academicYearId = options.academicYearId ?? null;
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSections = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!fetchAllWhenNoClass && (classId == null || classId === '')) {
        setSections([]);
        return;
      }

      let response;
      if (classId) {
        response = await apiService.getSectionsByClass(classId);
      } else {
        response = await apiService.getSections(
          academicYearId ? { academic_year_id: academicYearId } : {}
        );
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
  }, [classId, fetchAllWhenNoClass, academicYearId]);

  return {
    sections,
    loading,
    error,
    refetch: fetchSections,
  };
};
