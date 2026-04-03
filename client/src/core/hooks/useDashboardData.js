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
  const { limit = 3 } = options;
  const [performers, setPerformers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getDashboardBestPerformers({ limit });
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
  }, [limit]);

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
  const { academicYearId } = options;
  const [summary, setSummary] = useState({ good: 0, average: 0, below: 0, series: [0, 0, 0] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getDashboardPerformanceSummary({ academicYearId });
        if (mounted && res.status === 'SUCCESS' && res.data) {
          setSummary({
            good: res.data.good ?? 0,
            average: res.data.average ?? 0,
            below: res.data.below ?? 0,
            series: res.data.series ?? [res.data.good ?? 0, res.data.average ?? 0, res.data.below ?? 0],
          });
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || 'Failed to fetch performance summary');
          setSummary({ good: 0, average: 0, below: 0, series: [0, 0, 0] });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [academicYearId]);

  return { summary, loading, error };
};

export const useDashboardTopSubjects = (options = {}) => {
  const { academicYearId } = options;
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getDashboardTopSubjects({ academicYearId });
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
  }, [academicYearId]);

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
  const { academicYearId } = options;
  const [feeStats, setFeeStats] = useState({
    totalFeesCollected: 0,
    fineCollected: 0,
    studentNotPaid: 0,
    totalOutstanding: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getDashboardFeeStats({ academicYearId });
        if (mounted && res.status === 'SUCCESS' && res.data) {
          setFeeStats({
            totalFeesCollected: res.data.totalFeesCollected ?? 0,
            fineCollected: res.data.fineCollected ?? 0,
            studentNotPaid: res.data.studentNotPaid ?? 0,
            totalOutstanding: res.data.totalOutstanding ?? 0,
          });
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || 'Failed to fetch fee stats');
          setFeeStats({ totalFeesCollected: 0, fineCollected: 0, studentNotPaid: 0, totalOutstanding: 0 });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [academicYearId]);

  return { feeStats, loading, error };
};

export const useDashboardFinanceSummary = (options = {}) => {
  const { academicYearId } = options;
  const [financeSummary, setFinanceSummary] = useState({
    totalEarnings: 0,
    totalExpenses: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getDashboardFinanceSummary({ academicYearId });
        if (mounted && res.status === 'SUCCESS' && res.data) {
          setFinanceSummary({
            totalEarnings: res.data.totalEarnings ?? 0,
            totalExpenses: res.data.totalExpenses ?? 0,
          });
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || 'Failed to fetch finance summary');
          setFinanceSummary({ totalEarnings: 0, totalExpenses: 0 });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [academicYearId]);

  return { financeSummary, loading, error };
};
