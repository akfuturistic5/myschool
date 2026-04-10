import { useEffect, useState } from 'react';
import { apiService } from '../services/apiService';

export const useMyAttendance = ({ days = 30, academicYearId = null, enabled = true } = {}) => {
  const [data, setData] = useState({ staff: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMyAttendance = async () => {
    if (!enabled) {
      setData({ staff: null });
      setError(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getMyAttendance({ days, academicYearId });
      setData(response?.data || { staff: null });
    } catch (err) {
      setError(err?.message || 'Failed to fetch my attendance');
      setData({ staff: null });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyAttendance();
  }, [days, academicYearId, enabled]);

  return {
    data,
    loading,
    error,
    refetch: fetchMyAttendance,
  };
};
