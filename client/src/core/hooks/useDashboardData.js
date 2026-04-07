import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

function formatEventDate(dateVal) {
  if (!dateVal) return 'N/A';
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatEventTime(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export const useDashboardUpcomingEvents = (options = {}) => {
  const { limit = 10 } = options;
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.getDashboardUpcomingEvents({ limit });
      if (res.status === 'SUCCESS' && Array.isArray(res.data)) {
        setEvents(
          res.data.map((e) => ({
            id: e.id,
            title: e.title || 'Event',
            description: e.description,
            startDate: e.start_date,
            endDate: e.end_date,
            startDateFormatted: formatEventDate(e.start_date),
            endDateFormatted: formatEventDate(e.end_date),
            timeRange: e.is_all_day
              ? 'All day'
              : `${formatEventTime(e.start_date)} - ${formatEventTime(e.end_date)}`,
            eventColor: e.event_color || 'bg-primary',
          }))
        );
      } else {
        setEvents([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [limit]);

  return { events, loading, error, refetch: fetchEvents };
};

export const useDashboardClassRoutine = (options = {}) => {
  const { limit = 5, academicYearId } = options;
  const [routine, setRoutine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRoutine = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.getDashboardClassRoutine({ limit, academicYearId });
      if (res.status === 'SUCCESS' && Array.isArray(res.data)) {
        setRoutine(res.data);
      } else {
        setRoutine([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch class routine');
      setRoutine([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutine();
  }, [limit, academicYearId]);

  return { routine, loading, error, refetch: fetchRoutine };
};

export const useDashboardBestPerformers = (options = {}) => {
  const { limit = 3, academicYearId } = options;
  const [performers, setPerformers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getDashboardBestPerformers({ limit, academicYearId });
        if (mounted && res.status === 'SUCCESS' && Array.isArray(res.data)) {
          setPerformers(res.data);
        } else if (mounted) {
          setPerformers([]);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || 'Failed to fetch best performers');
          setPerformers([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [limit, academicYearId]);

  return { performers, loading, error };
};

export const useDashboardStarStudents = (options = {}) => {
  const { limit = 3, academicYearId } = options;
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getDashboardStarStudents({ limit, academicYearId });
        if (mounted && res.status === 'SUCCESS' && Array.isArray(res.data)) {
          setStudents(res.data);
        } else if (mounted) {
          setStudents([]);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || 'Failed to fetch star students');
          setStudents([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [limit, academicYearId]);

  return { students, loading, error };
};

export const useDashboardPerformanceSummary = (options = {}) => {
  const { academicYearId, classId = null } = options;
  const [summary, setSummary] = useState({
    good: 0,
    average: 0,
    below: 0,
    series: [0, 0, 0],
    averageScorePct: null,
    passPct: null,
    studentsWithExamData: 0,
    dataSource: 'exam_results',
    emptyMessage: null,
    classId: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getDashboardPerformanceSummary({
          academicYearId,
          classId,
        });
        if (mounted && res.status === 'SUCCESS' && res.data) {
          setSummary({
            good: res.data.good ?? 0,
            average: res.data.average ?? 0,
            below: res.data.below ?? 0,
            series: res.data.series ?? [res.data.good ?? 0, res.data.average ?? 0, res.data.below ?? 0],
            averageScorePct: res.data.averageScorePct ?? null,
            passPct: res.data.passPct ?? null,
            studentsWithExamData: res.data.studentsWithExamData ?? 0,
            dataSource: res.data.dataSource ?? 'exam_results',
            emptyMessage: res.data.emptyMessage ?? null,
            classId: res.data.classId ?? null,
          });
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || 'Failed to fetch performance summary');
          setSummary({
            good: 0,
            average: 0,
            below: 0,
            series: [0, 0, 0],
            averageScorePct: null,
            passPct: null,
            studentsWithExamData: 0,
            dataSource: 'exam_results',
            emptyMessage: null,
            classId: null,
          });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [academicYearId, classId]);

  return { summary, loading, error };
};

export const useDashboardTopSubjects = (options = {}) => {
  const { academicYearId, classId = null } = options;
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getDashboardTopSubjects({ academicYearId, classId });
        if (mounted && res.status === 'SUCCESS' && Array.isArray(res.data)) {
          setSubjects(res.data);
        } else if (mounted) {
          setSubjects([]);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || 'Failed to fetch top subjects');
          setSubjects([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [academicYearId, classId]);

  return { subjects, loading, error };
};

export const useDashboardNoticeBoard = (options = {}) => {
  const { limit = 5 } = options;
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNotices = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.getDashboardNoticeBoard({ limit });
      if (res.status === 'SUCCESS' && Array.isArray(res.data)) {
        setNotices(res.data);
      } else {
        setNotices([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch notices');
      setNotices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, [limit]);

  return { notices, loading, error, refetch: fetchNotices };
};

export const useDashboardRecentActivity = (options = {}) => {
  const { academicYearId } = options;
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getDashboardRecentActivity({ academicYearId });
        if (mounted && res.status === 'SUCCESS') {
          setActivity(res.data);
        } else if (mounted) {
          setActivity(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || 'Failed to fetch recent activity');
          setActivity(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [academicYearId]);

  return { activity, loading, error };
};

export const useDashboardFeeStats = (options = {}) => {
  const { academicYearId, feePeriod = 'all' } = options;
  const [feeStats, setFeeStats] = useState({
    totalFeesCollected: 0,
    fineCollected: 0,
    studentNotPaid: 0,
    totalOutstanding: 0,
    feePeriod: 'all',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getDashboardFeeStats({ academicYearId, feePeriod });
        if (mounted && res.status === 'SUCCESS' && res.data) {
          setFeeStats({
            totalFeesCollected: res.data.totalFeesCollected ?? 0,
            fineCollected: res.data.fineCollected ?? 0,
            studentNotPaid: res.data.studentNotPaid ?? 0,
            totalOutstanding: res.data.totalOutstanding ?? 0,
            feePeriod: res.data.feePeriod ?? feePeriod,
          });
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || 'Failed to fetch fee stats');
          setFeeStats({ totalFeesCollected: 0, fineCollected: 0, studentNotPaid: 0, totalOutstanding: 0, feePeriod: 'all' });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [academicYearId, feePeriod]);

  return { feeStats, loading, error };
};

export const useDashboardFinanceSummary = (options = {}) => {
  const { academicYearId, feePeriod = 'all' } = options;
  const [financeSummary, setFinanceSummary] = useState({
    totalEarnings: 0,
    totalFines: 0,
    totalExpenses: 0,
    netPosition: 0,
    feePeriod: 'all',
    expensesTracked: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getDashboardFinanceSummary({ academicYearId, feePeriod });
        if (mounted && res.status === 'SUCCESS' && res.data) {
          const te = res.data.totalEarnings ?? 0;
          const tf = res.data.totalFines ?? 0;
          const tx = res.data.totalExpenses ?? 0;
          const net = res.data.netPosition != null ? res.data.netPosition : te + tf - tx;
          setFinanceSummary({
            totalEarnings: te,
            totalFines: tf,
            totalExpenses: tx,
            netPosition: net,
            feePeriod: res.data.feePeriod ?? feePeriod,
            expensesTracked: Boolean(res.data.expensesTracked),
          });
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || 'Failed to fetch finance summary');
          setFinanceSummary({
            totalEarnings: 0,
            totalFines: 0,
            totalExpenses: 0,
            netPosition: 0,
            feePeriod: 'all',
            expensesTracked: false,
          });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [academicYearId, feePeriod]);

  return { financeSummary, loading, error };
};

/** Headmaster: school events + calendar_events merged */
export const useDashboardMergedUpcomingEvents = (options = {}) => {
  const { limit = 10 } = options;
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.getDashboardMergedUpcomingEvents({ limit });
      if (res.status === 'SUCCESS' && Array.isArray(res.data)) {
        setEvents(
          res.data.map((e) => ({
            id: e.id,
            source: e.source,
            title: e.title || 'Event',
            start_date: e.start_date,
            end_date: e.end_date,
            is_all_day: e.is_all_day,
            event_color: e.event_color || 'bg-primary',
          }))
        );
      } else {
        setEvents([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [limit]);

  return { upcomingEvents: events, loading, error, refetch: fetchEvents };
};

export const useDashboardStudentActivity = (options = {}) => {
  const { limit = 5, academicYearId } = options;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getDashboardStudentActivity({ limit, academicYearId });
        if (mounted && res.status === 'SUCCESS' && Array.isArray(res.data)) {
          setItems(res.data);
        } else if (mounted) {
          setItems([]);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || 'Failed to fetch activity');
          setItems([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [limit, academicYearId]);

  return { activityItems: items, loading, error };
};

/** Current user's todos (from /todos) for dashboard widget */
export const useDashboardMyTodos = (options = {}) => {
  const { limit = 5 } = options;
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getTodos();
        if (!mounted) return;
        const raw = Array.isArray(res?.data) ? res.data : [];
        setTodos(raw.slice(0, limit));
      } catch (err) {
        if (mounted) {
          setError(err.message || 'Failed to fetch todos');
          setTodos([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [limit]);

  return { todos, loading, error };
};
