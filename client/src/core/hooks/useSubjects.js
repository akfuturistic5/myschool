import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

export const useSubjects = (classId = null, options = {}) => {
  const fetchAllWhenNoClass = options.fetchAllWhenNoClass !== false;
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSubjects = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!fetchAllWhenNoClass && (classId == null || classId === '')) {
        setSubjects([]);
        return;
      }
      const response = classId
        ? await apiService.getSubjectsByClass(classId)
        : await apiService.getSubjects();
      
      if (response.status === 'SUCCESS') {
        setSubjects(response.data);
      } else {
        setError('Failed to fetch subjects data');
      }
    } catch (err) {
      console.error('Error fetching subjects:', err);
      setError(err.message || 'Failed to fetch subjects data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, [classId, fetchAllWhenNoClass]);

  return {
    subjects,
    loading,
    error,
    refetch: fetchSubjects
  };
};
