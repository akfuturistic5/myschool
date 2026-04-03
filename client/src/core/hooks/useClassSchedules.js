import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { classRoutine } from '../data/json/class-routine';

// Format time from "HH:MM:SS" or "HH:MM" to "HH:MM AM/PM"
function formatTimeDisplay(t) {
  if (t == null || t === '') return 'N/A';
  const s = String(t).trim();
  if (/^\d{1,2}:\d{2}\s*[AP]M$/i.test(s)) return s;
  const match = s.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return s;
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

export const useClassSchedules = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getClassSchedules();
      const list = Array.isArray(response) ? response : (response?.data ?? []);
      if (Array.isArray(list)) {
        const mapped = list.map((row, index) => ({
          key: String(row.id ?? index + 1),
          id: row.id?.toString() || `RT${String(index + 1).padStart(6, '0')}`,
          class: row.class ?? 'N/A',
          section: row.section ?? 'N/A',
          teacher: row.teacher ?? 'N/A',
          subject: row.subject ?? 'N/A',
          day: row.day ?? 'N/A',
          startTime: formatTimeDisplay(row.startTime) ?? 'N/A',
          endTime: formatTimeDisplay(row.endTime) ?? 'N/A',
          classRoom: row.classRoom ?? 'N/A',
          // Store original data for edit modal
          originalData: row
        }));
        setData(mapped);
      } else {
        setData([]);
      }
    } catch (err) {
      console.error('Error fetching class schedules:', err);
      setError(err?.message ?? 'Failed to fetch class schedules');
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
    fallbackData: classRoutine,
  };
};
