import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

export const useHostelRooms = () => {
  const [hostelRooms, setHostelRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHostelRooms = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getHostelRooms();

      // Accept both { status: 'SUCCESS', data: [...] } and direct { data: [...] }
      const rawData = response?.data ?? (Array.isArray(response) ? response : null);
      const dataArray = Array.isArray(rawData) ? rawData : [];

      if (dataArray.length >= 0) {
        // Transform the API data to match the expected format
        const transformedData = dataArray.map((room, index) => {
          // Room Type: from room_types table JOIN (already handled by COALESCE in backend)
          const roomTypeValue = room.room_type || null;
          
          // No Of Bed: from current_occupancy column
          const noOfBedValue = room.current_occupancy !== undefined && room.current_occupancy !== null ? room.current_occupancy : null;
          
          // Cost Per Bed: from monthly_fee column (singular in database)
          const costValue = room.monthly_fee !== undefined && room.monthly_fee !== null ? room.monthly_fee :
                           room.monthly_fees !== undefined && room.monthly_fees !== null ? room.monthly_fees : null;
          
          // Format amount with ₹ (Indian Rupees) sign
          const formattedAmount = costValue !== null
            ? (typeof costValue === 'number' 
                ? `₹${costValue}` 
                : (costValue.toString().startsWith('₹') || costValue.toString().startsWith('$')
                    ? costValue.toString().replace('$', '₹')
                    : `₹${costValue}`))
            : 'N/A';
          
          const transformed = {
            key: (index + 1).toString(),
            id: `HR${room.id}` || `HR${index + 1}`,
            roomNo: room.room_number || 'N/A',
            hostelName: room.hostel_name || 'N/A',
            roomType: roomTypeValue || 'N/A',
            noofBed: noOfBedValue !== null ? String(noOfBedValue) : 'N/A',
            amount: formattedAmount,
            originalData: room, // Store original data for edit modal
          };

          return transformed;
        });
        
        setHostelRooms(transformedData);
      }
    } catch (err) {
      console.error('Error fetching hostel rooms:', err);
      setError(err.message || 'Failed to fetch hostel rooms data');
      setHostelRooms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHostelRooms();
  }, []);

  return {
    hostelRooms,
    loading,
    error,
    refetch: fetchHostelRooms
  };
};
