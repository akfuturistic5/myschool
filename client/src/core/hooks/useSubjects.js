import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

export const useSubjects = (classId = null) => {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSubjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = classId ? await apiService.getSubjectsByClass(classId) : await apiService.getSubjects();
      
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
  }, [classId]);

  return {
    subjects,
    loading,
    error,
    refetch: fetchSubjects
  };
};
