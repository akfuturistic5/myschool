import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';

export const useHostels = () => {
  const [hostels, setHostels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHostels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getHostels();

      const rawData = response?.data ?? (Array.isArray(response) ? response : null);
      const dataArray = Array.isArray(rawData) ? rawData : [];

      const transformedData = dataArray.map((hostel, index) => {
        const intakeValue =
          hostel.intake_capacity != null && hostel.intake_capacity !== ''
            ? hostel.intake_capacity
            : hostel.intake != null && hostel.intake !== ''
              ? hostel.intake
              : hostel.capacity != null && hostel.capacity !== ''
                ? hostel.capacity
                : hostel.total_rooms != null && hostel.total_rooms !== ''
                  ? hostel.total_rooms
                  : null;

        const descriptionValue =
          hostel.description !== undefined && hostel.description !== null && hostel.description !== ''
            ? hostel.description
            : hostel.hostel_description !== undefined &&
                hostel.hostel_description !== null &&
                hostel.hostel_description !== ''
              ? hostel.hostel_description
              : hostel.facilities !== undefined && hostel.facilities !== null && hostel.facilities !== ''
                ? hostel.facilities
                : hostel.desc !== undefined && hostel.desc !== null && hostel.desc !== ''
                  ? hostel.desc
                  : null;

        return {
          key: (index + 1).toString(),
          dbId: hostel.id,
          id: `H${hostel.id}`,
          hostelName: hostel.hostel_name || hostel.name || 'N/A',
          hostelType: hostel.hostel_type || hostel.type || 'N/A',
          address: hostel.address || 'N/A',
          inTake: intakeValue !== null && intakeValue !== undefined ? String(intakeValue) : 'N/A',
          description: descriptionValue !== null ? String(descriptionValue) : 'N/A',
          originalData: hostel,
        };
      });

      setHostels(transformedData);
    } catch (err) {
      console.error('Error fetching hostels:', err);
      setError(err.message || 'Failed to fetch hostels data');
      setHostels([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHostels();
  }, [fetchHostels]);

  return {
    hostels,
    loading,
    error,
    refetch: fetchHostels,
  };
};
