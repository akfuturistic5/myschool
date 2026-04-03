import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService.js';

export const useCalendarEvents = (params = {}) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getCalendarEvents(params);
      setEvents(response.data || []);
    } catch (err) {
      console.error('Error fetching calendar events:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch calendar events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [JSON.stringify(params)]);

  return {
    events,
    loading,
    error,
    refetch: fetchEvents,
  };
};
