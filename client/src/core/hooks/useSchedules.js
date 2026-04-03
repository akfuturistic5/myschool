import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { scheduleClass } from '../data/json/schedule_class';

export const useSchedules = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getSchedules();
      const list = Array.isArray(response) ? response : (response?.data ?? []);
      if (Array.isArray(list)) {
        const mapped = list.map((row, index) => ({
          key: String(row.id ?? index + 1),
          id: row.id != null ? String(row.id) : `S${String(index + 1).padStart(6, '0')}`,
          type: row.type ?? 'Class',
          startTime: row.startTime ?? 'N/A',
          endTime: row.endTime ?? 'N/A',
          status: row.status ?? 'Active',
          originalData: row
        }));
        setData(mapped);
      } else {
        setData([]);
      }
    } catch (err) {
      console.error('Error fetching schedules:', err);
      setError(err?.message ?? 'Failed to fetch schedules');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchSchedules,
    fallbackData: scheduleClass
  };
};
