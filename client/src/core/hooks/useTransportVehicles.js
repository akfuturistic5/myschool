import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { apiService } from '../services/apiService';

const defaultImg = 'assets/img/parents/parent-01.jpg';

export const useTransportVehicles = (initialParams = {}) => {
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
  const paramsRef = useRef(params);
  const paramsKey = useMemo(() => JSON.stringify(params), [params]);

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  const paramsKey = JSON.stringify(params);

  const fetchVehicles = useCallback(async (overrides = {}) => {
    try {
      setLoading(true);
      setError(null);

      const combinedParams = { ...params, ...overrides };
      const response = await apiService.getTransportVehicles(combinedParams);
      
      if (response && response.status === "SUCCESS") {
        const list = response.data || [];
        const mapped = list.map((row, index) => ({
          key: String(row.id || index + 1),
          id: row.id,
          displayId: row.vehicle_code,
          vehicleNo: row.vehicle_number || 'N/A',
          vehicleModel: row.vehicle_model || row.model || '-',
          img: row.photo_url || defaultImg,
          madeofYear: row.made_of_year || 'N/A',
          registrationNo: row.registration_number || 'N/A',
          chassisNo: row.chassis_number || 'N/A',
          gps: row.gps_device_id || 'N/A',
          seatCapacity: row.seat_capacity ?? row.seating_capacity ?? '-',
          name: row.driver_name || 'N/A',
          phone: row.driver_phone || 'N/A',
          status: row.is_active ? 'Active' : 'Inactive',
          statusClass: row.is_active ? 'badge badge-soft-success' : 'badge badge-soft-danger',
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
      console.error('Error fetching transport vehicles:', err);
      setError(err?.message || 'Failed to fetch vehicles');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [paramsKey, params]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  return {
    data,
    loading,
    error,
    metadata,
    params,
    setParams,
    refetch: fetchVehicles,
  };
};
