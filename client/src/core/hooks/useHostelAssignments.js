import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiService } from '../services/apiService';

/** makeRequest returns the JSON body ({ success, data, ... }), not axios.response */
function normalizeAssignmentList(body) {
  if (body == null) return [];
  if (Array.isArray(body)) return body;
  if (typeof body !== 'object') return [];
  if (body.success === false || body.status === 'ERROR') return [];
  if (Array.isArray(body.data)) return body.data;
  const nested = body.data;
  if (nested && typeof nested === 'object' && Array.isArray(nested.rows)) return nested.rows;
  if (Array.isArray(body.rows)) return body.rows;
  return [];
}

export const useHostelAssignments = (filters = {}) => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const filtersKey = useMemo(() => JSON.stringify(filters ?? {}), [filters]);

  const fetchAssignments = useCallback(async () => {
    let params = {};
    try {
      params = JSON.parse(filtersKey);
    } catch {
      params = {};
    }
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getHostelAssignments(params);
      setAssignments(normalizeAssignmentList(response));
    } catch (err) {
      console.error('Error fetching hostel assignments:', err);
      setError(err.message || 'Failed to fetch assignments');
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [filtersKey]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  return { assignments, loading, error, refetch: fetchAssignments };
};
