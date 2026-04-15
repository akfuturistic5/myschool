import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { transportRouteList } from '../data/json/transport_route';

function formatAddedOn(createdAt) {
  if (!createdAt) return 'N/A';
  return new Date(createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const useTransportRoutes = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRoutes = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getTransportRoutes();
      const list = Array.isArray(response) ? response : (response?.data ?? []);
      if (Array.isArray(list) && list.length >= 0) {
        const mapped = list.map((row, index) => ({
          key: String(row.id ?? index + 1),
          id: row.route_code ?? String(row.id),
          routes: row.route_name ?? 'N/A',
          status: row.is_active ? 'Active' : 'Inactive',
          statusClass: row.is_active ? 'badge badge-soft-success' : 'badge badge-soft-danger',
          addedOn: formatAddedOn(row.created_at),
          originalData: row, // Store original data for edit modal
        }));
        setData(mapped);
      } else {
        setData([]);
      }
    } catch (err) {
      console.error('Error fetching transport routes:', err);
      setError(err?.message ?? 'Failed to fetch routes');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchRoutes,
    fallbackData: transportRouteList,
  };
};
