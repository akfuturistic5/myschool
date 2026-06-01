
import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService.js';

interface UseSectionsOptions {
  fetchAllWhenNoClass?: boolean;
  academicYearId?: number | string | null;
}

export const useSections = (
  classId: number | string | null = null,
  options: UseSectionsOptions = {}
) => {
  const fetchAllWhenNoClass = options.fetchAllWhenNoClass !== false;
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSections = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!fetchAllWhenNoClass && (classId == null || String(classId).trim() === '')) {
        setSections([]);
        return;
      }

      let response;
      if (classId) {
        response = await apiService.getClassSections(classId, options.academicYearId);
      } else {
        response = await apiService.getSections(options.academicYearId ?? null);
      }

      // Handle both { data: [...] } and direct array (for different API shapes)
      const raw = response?.data ?? (Array.isArray(response) ? response : null);
      setSections(Array.isArray(raw) ? raw : []);
    } catch (err: any) {
      console.error('Error fetching sections:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch sections');
      setSections([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSections();
  }, [classId, fetchAllWhenNoClass, options.academicYearId]);

  return {
    sections,
    loading,
    error,
    refetch: fetchSections,
  };
};
