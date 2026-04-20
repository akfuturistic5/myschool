import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { apiService } from '../services/apiService';
import { selectSelectedAcademicYearId } from '../data/redux/academicYearSlice';

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

/** First occurrence wins; avoids duplicate columns if the API ever repeats the same slot id. */
function dedupeSlotsById(slots) {
  if (!Array.isArray(slots)) return [];
  const seen = new Set();
  const out = [];
  for (const s of slots) {
    const id = Number(s?.id);
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    out.push(s);
  }
  return out;
}

export const useClassSchedules = (params = {}) => {
  const reduxAcademicYearId = useSelector(selectSelectedAcademicYearId);
  const { classId = null, sectionId = null, skip = false } = params;
  const academicYearId = params.academicYearId ?? reduxAcademicYearId ?? null;

  const [data, setData] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      setError(null);
      if (skip) {
        setData([]);
        setSlots([]);
        setError(null);
        return;
      }
      if (academicYearId == null) {
        setError('Select an academic year to load the timetable');
        setData([]);
        setSlots([]);
        return;
      }

      const useClassEndpoint =
        classId != null &&
        sectionId != null &&
        !Number.isNaN(Number(classId)) &&
        !Number.isNaN(Number(sectionId));

      const response = useClassEndpoint
        ? await apiService.getTimetableForClass({
            academicYearId,
            classId: Number(classId),
            sectionId: Number(sectionId),
          })
        : await apiService.getClassSchedulesScoped({
            academicYearId,
            classId: classId != null ? Number(classId) : undefined,
            sectionId: sectionId != null ? Number(sectionId) : undefined,
          });

      let list = [];
      let slotList = [];
      if (Array.isArray(response)) {
        list = response;
      } else if (response?.data?.entries && Array.isArray(response.data.entries)) {
        list = response.data.entries;
        slotList = Array.isArray(response.data.slots) ? response.data.slots : [];
      } else {
        list = response?.data ?? [];
      }

      if (Array.isArray(list)) {
        const filtered = list.filter((row) => {
          const classOk = classId == null || Number(row.class_id) === Number(classId);
          const sectionOk = sectionId == null || Number(row.section_id) === Number(sectionId);
          return classOk && sectionOk;
        });
        const mapped = filtered.map((row, index) => ({
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
          originalData: row,
        }));
        setData(mapped);
        setSlots(dedupeSlotsById(slotList));
      } else {
        setData([]);
        setSlots([]);
      }
    } catch (err) {
      console.error('Error fetching class schedules:', err);
      setError(err?.message ?? 'Failed to fetch class schedules');
      setData([]);
      setSlots([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [classId, sectionId, academicYearId, skip]);

  return {
    data,
    slots,
    loading,
    error,
    refetch: fetchSchedules,
    fallbackData: [],
  };
};
