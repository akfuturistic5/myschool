
import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';
import { formatDateDMY } from '../utils/dateDisplay';

export type UseHostelsOptions = { includeInactive?: boolean };

/** Hostels are not scoped by academic year; list is school-wide. */
export const useHostels = (options?: UseHostelsOptions) => {
  const includeInactive = options?.includeInactive === true;
  const [hostels, setHostels] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHostels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getHostels(
        includeInactive ? { include_inactive: true } : {}
      );

      const rawData = response?.data ?? (Array.isArray(response) ? response : null);
      const dataArray = Array.isArray(rawData) ? rawData : [];

      const transformedData = dataArray.map((hostel: any, index: number) => {
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
              : null;

        const pn = hostel.contact_number != null && hostel.contact_number !== '' ? String(hostel.contact_number) : '';
        const em = hostel.email != null && hostel.email !== '' ? String(hostel.email) : '';
        let contactSummary = 'N/A';
        if (pn && em) contactSummary = `${pn} · ${em}`;
        else if (pn) contactSummary = pn;
        else if (em) contactSummary = em;

        const gen = hostel.gender ?? hostel.hostel_type ?? hostel.type ?? null;
        const cat = hostel.hostel_category ?? 'student';

        return {
          key: (index + 1).toString(),
          dbId: hostel.id,
          id: `H${hostel.id}`,
          addedOn: formatDateDMY(hostel.created_at),
          isActive: hostel.is_active === true,
          hostelCode: hostel.code != null ? String(hostel.code) : '—',
          hostelName: hostel.hostel_name || hostel.name || 'N/A',
          hostelType:
            hostel.hostel_type || hostel.gender || hostel.type || 'N/A',
          hostelGender: gen != null ? String(gen) : 'N/A',
          hostelCategory:
            hostel.hostel_category != null ? String(hostel.hostel_category) : 'student',
          categoryLabel:
            cat === 'staff'
              ? 'Staff'
              : 'Student',
          contactSummary,
          address: hostel.address || 'N/A',
          inTake: intakeValue !== null && intakeValue !== undefined ? String(intakeValue) : 'N/A',
          description: descriptionValue !== null ? String(descriptionValue) : 'N/A',
          originalData: hostel,
        };
      });

      setHostels(transformedData);
    } catch (err: any) {
      console.error('Error fetching hostels:', err);
      setError(err.message || 'Failed to fetch hostels data');
      setHostels([]);
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

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
