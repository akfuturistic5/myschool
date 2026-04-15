import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';
import { transportAssignData } from '../data/json/transport_assign';

const defaultImg = 'assets/img/parents/parent-01.jpg';

export const useTransportAssignments = (params = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [metadata, setMetadata] = useState({
    totalCount: 0,
    page: 1,
    limit: 10,
    totalPages: 0
  });

  const fetchAssignments = useCallback(async (overrides = {}) => {
    try {
      setLoading(true);
      setError(null);
      
      const combinedParams = { ...params, ...overrides };
      const response = await apiService.getTransportAssignments(combinedParams);
      
      if (response && response.status === "SUCCESS") {
        const list = response.data || [];
        const mapped = list.map((row, index) => ({
          key: String(row.id || index + 1),
          id: row.assignment_code || String(row.id),
          route: row.route_name || '—',
          pickupPoint: row.point_name || '—',
          vehicle: row.vehicle_number || 'N/A',
          name: row.driver_name || 'N/A',
          img: row.photo_url || defaultImg,
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
      console.error('Error fetching transport assignments:', err);
      setError(err?.message || 'Failed to fetch assignments');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  return {
    data,
    loading,
    error,
    metadata,
    refetch: fetchAssignments,
    fallbackData: transportAssignData,
  };
};
