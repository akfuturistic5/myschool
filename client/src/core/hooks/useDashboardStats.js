import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

const defaultStats = {
  students: { total: 0, active: 0, inactive: 0 },
  teachers: { total: 0, active: 0, inactive: 0 },
  staff: { total: 0, active: 0, inactive: 0 },
  subjects: { total: 0, active: 0, inactive: 0 },
};

export const useDashboardStats = (options = {}) => {
  const { academicYearId } = options;
  const [stats, setStats] = useState(defaultStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getDashboardStats({ academicYearId });
      if (response.status === 'SUCCESS' && response.data) {
        setStats({
          students: response.data.students || defaultStats.students,
          teachers: response.data.teachers || defaultStats.teachers,
          staff: response.data.staff || defaultStats.staff,
          subjects: response.data.subjects || defaultStats.subjects,
        });
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setError(err.message || 'Failed to fetch dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [academicYearId]);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats,
  };
};
