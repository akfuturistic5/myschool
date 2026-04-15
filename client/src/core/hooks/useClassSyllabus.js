import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { classSyllabus as fallbackData } from '../data/json/class-syllabus';

export const useClassSyllabus = (options = {}) => {
  const { academicYearId } = options;
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSyllabus = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getClassSyllabus({ academicYearId });
      const list = Array.isArray(response) ? response : (response?.data ?? []);
      if (Array.isArray(list)) {
        const mapped = list.map((row, index) => ({
          key: String(row.id ?? index + 1),
          id: row.id?.toString() ?? String(index + 1),
          class: row.class ?? 'N/A',
          section: row.section ?? 'N/A',
          subjectGroup: row.subjectGroup ?? row.subject_group ?? '',
          createdDate: row.createdDate ?? row.created_date ?? '',
          status: row.status ?? 'Active',
          originalData: row
        }));
        setData(mapped);
      } else {
        setData([]);
      }
    } catch (err) {
      console.error('Error fetching class syllabus:', err);
      setError(err?.message ?? 'Failed to fetch class syllabus');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSyllabus();
  }, [academicYearId]);

  return {
    data,
    loading,
    error,
    refetch: fetchSyllabus,
    fallbackData
  };
};
