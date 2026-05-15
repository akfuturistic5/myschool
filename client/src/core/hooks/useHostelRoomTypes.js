import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';
import { formatDateDMY } from '../utils/dateDisplay';

export const useHostelRoomTypes = (options = {}) => {
  const includeInactive = options.includeInactive === true;
  const [roomTypes, setRoomTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRoomTypes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getHostelRoomTypes(
        includeInactive ? { include_inactive: true } : {}
      );

      const rawData = response?.data ?? (Array.isArray(response) ? response : null);
      const dataArray = Array.isArray(rawData) ? rawData : [];

      const transformedData = dataArray.map((roomType, index) => ({
        key: (index + 1).toString(),
        dbId: roomType.id,
        id: `HRT${roomType.id}`,
        addedOn: formatDateDMY(roomType.created_at),
        isActive: roomType.is_active === true,
        roomType: roomType.name || roomType.type_name || 'N/A',
        description: roomType.description || 'N/A',
        sharing_capacity: roomType.sharing_capacity ?? null,
        hasAc: Boolean(roomType.has_ac),
        hasWifi: Boolean(roomType.has_wifi),
        hasBath: Boolean(roomType.has_attached_bathroom),
        originalData: roomType,
      }));

      setRoomTypes(transformedData);
    } catch (err) {
      console.error('Error fetching hostel room types:', err);
      setError(err.message || 'Failed to fetch hostel room types');
      setRoomTypes([]);
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

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
