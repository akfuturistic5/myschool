
import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';
import { formatDateDMY } from '../utils/dateDisplay';

export type UseHostelRoomsOptions = { includeInactive?: boolean };

export const useHostelRooms = (
  academicYearId?: number | string | null,
  options?: UseHostelRoomsOptions
) => {
  const includeInactive = options?.includeInactive === true;
  const [hostelRooms, setHostelRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHostelRooms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getHostelRooms(
        includeInactive ? { include_inactive: true } : {}
      );

      const rawData = response?.data ?? (Array.isArray(response) ? response : null);
      const dataArray = Array.isArray(rawData) ? rawData : [];

      const transformedData = dataArray.map((room: any, index: number) => {
        const roomTypeValue = room.room_type || room.room_type_name || null;

        const capEff =
          room.capacity_effective != null
            ? room.capacity_effective
            : room.max_occupancy !== undefined && room.max_occupancy !== null
              ? room.max_occupancy
              : room.bed_count != null
                ? room.bed_count
                : null;

        const occ = room.occupied_bed_count != null ? Number(room.occupied_bed_count) : null;

        const bedsValue = capEff;

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

        const capacityNum = capEff != null ? Number(capEff) : NaN;
        const occNum = occ != null && occ === occ ? occ : 0;
        const occupancyShort =
          !Number.isNaN(capacityNum) && capacityNum > 0
            ? `${occNum}/${capacityNum}`
            : bedsValue !== null
              ? String(bedsValue)
              : 'N/A';

        return {
          key: (index + 1).toString(),
          dbId: room.id,
          id: `HR${room.id}`,
          addedOn: formatDateDMY(room.created_at),
          isActive: room.is_active === true,
          roomNo: room.room_number || 'N/A',
          hostelName: room.hostel_name || 'N/A',
          floorName:
            room.floor_name != null
              ? String(room.floor_name)
              : room.floor_number != null
                ? `Floor ${room.floor_number}`
                : '—',
          roomType: roomTypeValue || 'N/A',
          noofBed: bedsValue !== null ? String(bedsValue) : 'N/A',
          occupancyShort,
          roomStatus: room.room_status != null ? String(room.room_status) : '—',
          notesShort:
            room.notes != null && String(room.notes).trim() !== ''
              ? String(room.notes).length > 40
                ? `${String(room.notes).slice(0, 40)}…`
                : String(room.notes)
              : '—',
          amount: formattedAmount,
          originalData: room,
        };
      });

      setHostelRooms(transformedData);
    } catch (err: any) {
      console.error('Error fetching hostel rooms:', err);
      setError(err.message || 'Failed to fetch hostel rooms data');
      setHostelRooms([]);
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => {
    fetchHostelRooms();
  }, [fetchHostelRooms, academicYearId]);

  return {
    hostelRooms,
    loading,
    error,
    refetch: fetchHostelRooms,
  };
};
