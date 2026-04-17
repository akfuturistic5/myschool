import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';

export const useHostelRooms = (academicYearId) => {
  const [hostelRooms, setHostelRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHostelRooms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getHostelRooms({
        academic_year_id: academicYearId ?? undefined,
      });

      const rawData = response?.data ?? (Array.isArray(response) ? response : null);
      const dataArray = Array.isArray(rawData) ? rawData : [];

      const transformedData = dataArray.map((room, index) => {
        const roomTypeValue = room.room_type || null;

        const bedsValue =
          room.max_occupancy !== undefined && room.max_occupancy !== null
            ? room.max_occupancy
            : room.current_occupancy !== undefined && room.current_occupancy !== null
              ? room.current_occupancy
              : null;

        const costValue =
          room.monthly_fee !== undefined && room.monthly_fee !== null
            ? room.monthly_fee
            : room.monthly_fees !== undefined && room.monthly_fees !== null
              ? room.monthly_fees
              : null;

        const formattedAmount =
          costValue !== null
            ? typeof costValue === 'number'
              ? `₹${costValue}`
              : costValue.toString().startsWith('₹') || costValue.toString().startsWith('$')
                ? costValue.toString().replace('$', '₹')
                : `₹${costValue}`
            : 'N/A';

        return {
          key: (index + 1).toString(),
          dbId: room.id,
          id: `HR${room.id}`,
          roomNo: room.room_number || 'N/A',
          hostelName: room.hostel_name || 'N/A',
          roomType: roomTypeValue || 'N/A',
          noofBed: bedsValue !== null ? String(bedsValue) : 'N/A',
          amount: formattedAmount,
          originalData: room,
        };
      });

      setHostelRooms(transformedData);
    } catch (err) {
      console.error('Error fetching hostel rooms:', err);
      setError(err.message || 'Failed to fetch hostel rooms data');
      setHostelRooms([]);
    } finally {
      setLoading(false);
    }
  }, [academicYearId]);

  useEffect(() => {
    fetchHostelRooms();
  }, [fetchHostelRooms]);

  return {
    hostelRooms,
    loading,
    error,
    refetch: fetchHostelRooms,
  };
};
