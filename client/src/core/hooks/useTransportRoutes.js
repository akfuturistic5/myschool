import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';
import { transportRouteList } from '../data/json/transport_route';

function formatAddedOn(createdAt) {
  if (!createdAt) return 'N/A';
  return new Date(createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const useTransportRoutes = (initialParams = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  
  const [params, setParams] = useState({
    page: 1,
    limit: 10,
    search: '',
    status: 'all',
    pickup_point_id: 'all',
    sortField: 'created_at',
    sortOrder: 'DESC',
    ...initialParams
  });

  const fetchRoutes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.getTransportRoutes(params);
      
      // Handle the standardized response structure { status, message, data, metadata }
      const list = response?.data ?? [];
      const metadata = response?.metadata ?? {};
      
      if (Array.isArray(list)) {
        const mapped = list.map((row, index) => ({
          key: String(row.id ?? index + 1),
          id: row.id,
          routes: row.route_name ?? 'N/A',
          distance_km: row.distance_km ?? 0,
          status: row.is_active ? 'Active' : 'Inactive',
          statusClass: row.is_active ? 'badge badge-soft-success' : 'badge badge-soft-danger',
          addedOn: formatAddedOn(row.created_at),
          stopsSummary: row.stops?.map(s => s.point_name).join(', ') || 'No Stops',
          originalData: row,
        }));
        setData(mapped);
        setTotal(metadata.total ?? mapped.length);
      } else {
        setData([]);
        setTotal(0);
      }
    } catch (err) {
      console.error('Error fetching transport routes:', err);
      setError(err?.message ?? 'Failed to fetch routes');
      // If server fails, we still have fallbackData from the view, but here we'll just set empty to allow UI to show error
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  const updateParams = (newParams) => {
    setParams(prev => ({ ...prev, ...newParams }));
  };

  return {
    data,
    loading,
    error,
    total,
    params,
    setParams: updateParams,
    refetch: fetchRoutes,
    fallbackData: transportRouteList,
  };
};
