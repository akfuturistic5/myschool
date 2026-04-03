import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService.js';

/**
 * Fetches school-wide events (from events table).
 * Returns all events for Events page, or upcoming + completed for dashboards.
 */
export const useEvents = (options = {}) => {
  const { limit = 50, forDashboard = false } = options;
  const [events, setEvents] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [completedEvents, setCompletedEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (forDashboard) {
        const [upcomingRes, completedRes] = await Promise.all([
          apiService.getUpcomingEvents({ limit: limit || 10 }),
          apiService.getCompletedEvents({ limit: limit || 5 }),
        ]);
        setUpcomingEvents(upcomingRes?.data || []);
        setCompletedEvents(completedRes?.data || []);
        setEvents([]);
      } else {
        const res = await apiService.getEvents({ limit });
        setEvents(res?.data || []);
        setUpcomingEvents([]);
        setCompletedEvents([]);
      }
    } catch (err) {
      console.error('Error fetching events:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
      setEvents([]);
      setUpcomingEvents([]);
      setCompletedEvents([]);
    } finally {
      setLoading(false);
    }
  }, [forDashboard, limit]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return {
    events,
    upcomingEvents,
    completedEvents,
    loading,
    error,
    refetch: fetchEvents,
  };
};
