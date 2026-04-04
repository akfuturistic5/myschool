import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

const defaultStats = {
  students: { total: 0, active: 0, inactive: 0 },
  teachers: { total: 0, active: 0, inactive: 0 },
  staff: { total: 0, active: 0, inactive: 0 },
  subjects: { total: 0, active: 0, inactive: 0 },
};

const defaultTrends = {
  studentsActivePct: 0,
  teachersActivePct: 0,
  staffActivePct: 0,
  subjectsActivePct: 0,
};

const defaultAttendanceToday = {
  date: null,
  scope: 'day',
  students: {
    present: 0,
    absent: 0,
    late: 0,
    halfDay: 0,
    totalMarked: 0,
    attendancePct: 0,
  },
  teachers: {
    present: 0,
    absent: 0,
    late: 0,
    totalMarked: 0,
    attendancePct: 0,
    isProxy: true,
  },
  staff: {
    present: 0,
    absent: 0,
    late: 0,
    totalMarked: 0,
    attendancePct: 0,
    isProxy: true,
  },
};

export const useDashboardStats = (options = {}) => {
  const { academicYearId, attendanceDate = null, attendanceScope = 'day' } = options;
  const [stats, setStats] = useState(defaultStats);
  const [trends, setTrends] = useState(defaultTrends);
  const [attendanceToday, setAttendanceToday] = useState(defaultAttendanceToday);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getDashboardStats({
        academicYearId,
        attendanceDate: attendanceScope === 'all_time' ? null : attendanceDate,
        attendanceScope,
      });
      if (response.status === 'SUCCESS' && response.data) {
        const d = response.data;
        setStats({
          students: d.students || defaultStats.students,
          teachers: d.teachers || defaultStats.teachers,
          staff: d.staff || defaultStats.staff,
          subjects: d.subjects || defaultStats.subjects,
        });
        setTrends({
          studentsActivePct: d.trends?.studentsActivePct ?? defaultTrends.studentsActivePct,
          teachersActivePct: d.trends?.teachersActivePct ?? defaultTrends.teachersActivePct,
          staffActivePct: d.trends?.staffActivePct ?? defaultTrends.staffActivePct,
          subjectsActivePct: d.trends?.subjectsActivePct ?? defaultTrends.subjectsActivePct,
        });
        setAttendanceToday({
          date: d.attendanceToday?.date ?? defaultAttendanceToday.date,
          scope: d.attendanceToday?.scope ?? defaultAttendanceToday.scope,
          students: { ...defaultAttendanceToday.students, ...d.attendanceToday?.students },
          teachers: { ...defaultAttendanceToday.teachers, ...d.attendanceToday?.teachers },
          staff: { ...defaultAttendanceToday.staff, ...d.attendanceToday?.staff },
        });
      } else {
        setStats(defaultStats);
        setTrends(defaultTrends);
        setAttendanceToday(defaultAttendanceToday);
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setError(err.message || 'Failed to fetch dashboard stats');
      setStats(defaultStats);
      setTrends(defaultTrends);
      setAttendanceToday(defaultAttendanceToday);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [academicYearId, attendanceDate, attendanceScope]);

  return {
    stats,
    trends,
    attendanceToday,
    loading,
    error,
    refetch: fetchStats,
  };
};
