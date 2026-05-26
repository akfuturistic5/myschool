import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService.js';

const DEFAULT_STATS = { inbox: 0, done: 0, important: 0, trash: 0 };

/**
 * @param {{ view?: string, priority?: string }} params
 */
export const useTodos = (params = {}) => {
  const [todos, setTodos] = useState([]);
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTodos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getTodos(params);
      const list = Array.isArray(response?.data) ? response.data : [];
      setTodos(list);
      if (response?.stats && typeof response.stats === 'object') {
        setStats({
          inbox: Number(response.stats.inbox) || 0,
          done: Number(response.stats.done) || 0,
          important: Number(response.stats.important) || 0,
          trash: Number(response.stats.trash) || 0,
        });
      }
    } catch (err) {
      console.error('Error fetching todos:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch todos');
      setTodos([]);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(params)]);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  return {
    todos,
    stats,
    loading,
    error,
    refetch: fetchTodos,
  };
};
