import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { transportdriver } from '../data/json/transport_driver';

const defaultImg = 'assets/img/parents/parent-01.jpg';

export const useTransportDrivers = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getTransportDrivers();
      const list = Array.isArray(response) ? response : (response?.data ?? []);
      if (Array.isArray(list)) {
        const mapped = list.map((row, index) => {
          const displayName = row.name ?? row.driver_name ?? [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
          return {
          key: String(row.id ?? index + 1),
          id: row.driver_code ?? String(row.id),
          name: displayName || 'N/A',
          phone: row.phone ?? 'N/A',
          driverLicenseNo: row.license_number ?? 'N/A',
          address: row.address ?? 'N/A',
          status: row.is_active ? 'Active' : 'Inactive',
          statusClass: row.is_active ? 'badge badge-soft-success' : 'badge badge-soft-danger',
          img: row.photo_url || defaultImg,
          originalData: row, // Store original data for edit modal
        };
        });
        setData(mapped);
      } else {
        setData([]);
      }
    } catch (err) {
      console.error('Error fetching transport drivers:', err);
      setError(err?.message ?? 'Failed to fetch drivers');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchDrivers,
    fallbackData: transportdriver,
  };
};
