import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { transportAssignData } from '../data/json/transport_assign';

const defaultImg = 'assets/img/parents/parent-01.jpg';

// Assignments are represented by vehicles: each vehicle row has driver_id = assigned driver.
export const useTransportAssignments = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getTransportVehicles();
      const list = Array.isArray(response) ? response : (response?.data ?? []);
      if (Array.isArray(list)) {
        const mapped = list.map((row, index) => ({
          key: String(row.id ?? index + 1),
          id: row.vehicle_code ?? row.id ?? String(index + 1),
          route: row.route ?? '—',
          pickupPoint: row.pickup_point ?? '—',
          vehicle: row.vehicle_number ?? 'N/A',
          name: row.driver_name ?? 'N/A',
          img: row.driver_photo_url || row.photo_url || defaultImg,
          phone: row.driver_phone ?? 'N/A',
          status: row.is_active ? 'Active' : 'Inactive',
          statusClass: row.is_active ? 'badge badge-soft-success' : 'badge badge-soft-danger',
          originalData: row, // Store original data for edit modal
        }));
        setData(mapped);
      } else {
        setData([]);
      }
    } catch (err) {
      console.error('Error fetching transport assignments (vehicles):', err);
      setError(err?.message ?? 'Failed to fetch assignments');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchAssignments,
    fallbackData: transportAssignData,
  };
};
