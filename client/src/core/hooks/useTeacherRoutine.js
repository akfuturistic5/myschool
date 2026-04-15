import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatTime(t) {
  if (t == null || t === '') return null;
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

/**
 * Fetches teacher's class schedule/routine.
 * @param {number|null} teacherId - Teacher ID (from useCurrentTeacher)
 * @param {Object} options - { academicYearId } for year filter
 * @returns {Object} { routine, loading, error, refetch }
 */
export const useTeacherRoutine = (teacherId, options = {}) => {
  const { academicYearId } = options;
  const [routine, setRoutine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRoutine = async () => {
    if (!teacherId) {
      setRoutine([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getTeacherRoutine(teacherId, { academicYearId });
      const raw = response?.data ?? response ?? {};
      const list = Array.isArray(raw) ? raw : (raw.routine ?? raw.schedules ?? []);
      const mapped = (Array.isArray(list) ? list : []).map((row) => {
        const day = row.dayOfWeek ?? row.day_of_week ?? row.day ?? DAY_NAMES[0];
        return {
          id: row.id,
          class: row.className ?? row.class_name ?? row.class ?? 'N/A',
          section: row.sectionName ?? row.section_name ?? row.section ?? 'N/A',
          subject: row.subjectName ?? row.subject_name ?? row.subject ?? 'N/A',
          day: typeof day === 'number' ? DAY_NAMES[day] : String(day),
          startTime: formatTime(row.startTime ?? row.start_time) ?? 'N/A',
          endTime: formatTime(row.endTime ?? row.end_time) ?? 'N/A',
          classRoom: row.roomNumber ?? row.room_number ?? row.room ?? row.classRoom ?? null,
        };
      });
      setRoutine(mapped);
    } catch (err) {
      console.error('Error fetching teacher routine:', err);
      setError(err?.message ?? 'Failed to fetch routine');
      setRoutine([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutine();
  }, [teacherId, academicYearId]);

  return {
    routine,
    loading,
    error,
    refetch: fetchRoutine,
  };
};
