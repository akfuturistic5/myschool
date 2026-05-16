import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService.js';

/**
 * Fetches school-wide events (from events table).
 * Returns all events for Events page, or upcoming + completed for dashboards.
 */
export const useEvents = (options = {}) => {
  const { limit = 50, forDashboard = false, params = {} } = options;
  const [events, setEvents] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [completedEvents, setCompletedEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const paramsKey = JSON.stringify(params || {});

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (forDashboard) {
        const [upcomingRes, completedRes] = await Promise.all([
          apiService.getUpcomingEvents({ 
            limit: limit || 10, 
            academic_year_id: params?.academic_year_id ?? params?.academicYearId 
          }),
          apiService.getCompletedEvents({ 
            limit: limit || 5, 
            academic_year_id: params?.academic_year_id ?? params?.academicYearId 
          }),
        ]);
        setUpcomingEvents(upcomingRes?.data || []);
        setCompletedEvents(completedRes?.data || []);
        setEvents([]);
      } else {
        const res = await apiService.getEvents({ limit, ...(params || {}) });
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
  }, [forDashboard, limit, paramsKey]);

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
