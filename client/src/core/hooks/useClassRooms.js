import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService.js';

export const useClassRooms = () => {
  const [classRooms, setClassRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchClassRooms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.getClassRooms();
      const data = res?.data || [];
      setClassRooms(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching class rooms:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch class rooms');
      setClassRooms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClassRooms();
  }, [fetchClassRooms]);

  const createClassRoom = async (data) => {
    const res = await apiService.createClassRoom(data);
    await fetchClassRooms();
    return res;
  };

  const updateClassRoom = async (id, data) => {
    const res = await apiService.updateClassRoom(id, data);
    await fetchClassRooms();
    return res;
  };

  const deleteClassRoom = async (id) => {
    await apiService.deleteClassRoom(id);
    await fetchClassRooms();
  };

  return {
    classRooms,
    loading,
    error,
    refetch: fetchClassRooms,
    createClassRoom,
    updateClassRoom,
    deleteClassRoom
  };
};
