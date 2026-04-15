import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { transportVehicles } from '../data/json/transport_vehicle';

const defaultImg = 'assets/img/parents/parent-01.jpg';

export const useTransportVehicles = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getTransportVehicles();
      const list = Array.isArray(response) ? response : (response?.data ?? []);
      if (Array.isArray(list)) {
        const mapped = list.map((row, index) => ({
          key: String(row.id ?? index + 1),
          id: row.vehicle_code ?? String(row.id),
          vehicleNo: row.vehicle_number ?? 'N/A',
          vehicleModel: row.vehicle_model ?? 'N/A',
          img: row.photo_url || row.driver_photo_url || defaultImg,
          madeofYear: row.year != null ? String(row.year) : 'N/A',
          registrationNo: row.registration_number ?? 'N/A',
          chassisNo: row.chassis_number ?? 'N/A',
          gps: row.gps_device_id ?? 'N/A',
          name: row.driver_name ?? 'N/A',
          phone: row.driver_phone ?? 'N/A',
          status: row.is_active ? 'Active' : 'Inactive',
          statusClass: row.is_active ? 'badge badge-soft-success' : 'badge badge-soft-danger',
          originalData: row,
        }));
        setData(mapped);
      } else {
        setData([]);
      }
    } catch (err) {
      console.error('Error fetching transport vehicles:', err);
      setError(err?.message ?? 'Failed to fetch vehicles');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchVehicles,
    fallbackData: transportVehicles,
  };
};
