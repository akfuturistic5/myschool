import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';

const defaultImg = 'assets/img/parents/parent-01.jpg';

export const useTransportDrivers = (initialParams = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [metadata, setMetadata] = useState({
    totalCount: 0,
    page: 1,
    limit: 10,
    totalPages: 0
  });

  const [params, setParams] = useState({
    page: 1,
    limit: 10,
    search: '',
    status: 'all',
    ...initialParams
  });

  const fetchDrivers = useCallback(async (overrides = {}) => {
    try {
      setLoading(true);
      setError(null);
      
      const combinedParams = { ...params, ...overrides };
      const response = await apiService.getTransportDrivers(combinedParams);
      
      if (response && response.status === "SUCCESS") {
        const list = response.data || [];
        const mapped = list.map((row, index) => ({
          key: row.id || index + 1,
          id: row.id,
          displayId: row.driver_code || String(row.id),
          name: row.name || row.driver_name || [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || 'N/A',
          role: row.role ? `${row.role.charAt(0).toUpperCase()}${row.role.slice(1)}` : 'Driver',
          phone: row.phone || 'N/A',
          driverLicenseNo: row.license_number || 'N/A',
          address: row.address || 'N/A',
          status: row.is_active ? 'Active' : 'Inactive',
          statusClass: row.is_active ? 'badge badge-soft-success' : 'badge badge-soft-danger',
          img: row.photo_url || defaultImg,
          originalData: row,
        }));
        
        setData(mapped);
        if (response.metadata) {
          setMetadata(response.metadata);
        }
      } else {
        setData([]);
      }
    } catch (err) {
      console.error('Error fetching drivers:', err);
      setError(err?.message || 'Failed to fetch drivers');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  return {
    data,
    loading,
    error,
    metadata,
    params,
    setParams,
    refetch: fetchDrivers,
  };
};
