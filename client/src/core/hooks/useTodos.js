import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService.js';

export const useTodos = (params = {}) => {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTodos = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getTodos(params);
      setTodos(response.data || []);
    } catch (err) {
      console.error('Error fetching todos:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch todos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodos();
  }, [JSON.stringify(params)]);

  return {
    todos,
    loading,
    error,
    refetch: fetchTodos,
  };
};
