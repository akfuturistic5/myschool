import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

export const useRoomTypes = () => {
  const [roomTypes, setRoomTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRoomTypes = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getRoomTypes();
      
      if (response.status === 'SUCCESS') {
        // Transform the API data to match the expected format
        const transformedData = response.data.map((roomType, index) => ({
          key: (index + 1).toString(),
          id: `RT${roomType.id}` || `RT${index + 1}`,
          roomType: roomType.room_type || roomType.type_name || 'N/A',
          description: roomType.description || 'N/A',
          originalData: roomType, // Store original data for edit modal
        }));
        
        setRoomTypes(transformedData);
      } else {
        setError('Failed to fetch room types data');
      }
    } catch (err) {
      console.error('Error fetching room types:', err);
      setError(err.message || 'Failed to fetch room types data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoomTypes();
  }, []);

  return {
    roomTypes,
    loading,
    error,
    refetch: fetchRoomTypes
  };
};
