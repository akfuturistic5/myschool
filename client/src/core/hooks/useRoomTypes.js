import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';

export const useRoomTypes = () => {
  const [roomTypes, setRoomTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRoomTypes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getRoomTypes();

      const rawData = response?.data ?? (Array.isArray(response) ? response : null);
      const dataArray = Array.isArray(rawData) ? rawData : [];

      const transformedData = dataArray.map((roomType, index) => ({
        key: (index + 1).toString(),
        dbId: roomType.id,
        id: `RT${roomType.id}`,
        roomType: roomType.room_type || roomType.type_name || 'N/A',
        description: roomType.description || 'N/A',
        originalData: roomType,
      }));

      setRoomTypes(transformedData);
    } catch (err) {
      console.error('Error fetching room types:', err);
      setError(err.message || 'Failed to fetch room types data');
      setRoomTypes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoomTypes();
  }, [fetchRoomTypes]);

  return {
    roomTypes,
    loading,
    error,
    refetch: fetchRoomTypes,
  };
};
