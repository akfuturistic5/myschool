import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';

function formatAddedOn(createdAt) {
  if (!createdAt) return 'N/A';
  return new Date(createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return 'N/A';
  // If it's HH:mm:ss format, just return HH:mm
  return timeStr.substring(0, 5);
}

export const useTransportPickupPoints = (initialParams = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metadata, setMetadata] = useState({
    total: 0,
    page: 1,
    limit: 10
  });

  const [params, setParams] = useState({
    page: 1,
    limit: 10,
    search: '',
    status: 'all',
    route_id: 'all',
    sortField: 'point_name',
    sortOrder: 'ASC',
    ...initialParams
  });

  const fetchPickupPoints = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getTransportPickupPoints(params);

      if (response && response.status === 'SUCCESS') {
        const list = response.data || [];
        const mapped = list.map((row) => ({
          key: String(row.id),
          id: String(row.id),
          pickupPoint: row.point_name || row.address || 'N/A',
          address: row.address || '',
          routeName: row.route_name || 'N/A',
          pickupTime: formatTime(row.pickup_time),
          dropTime: formatTime(row.drop_time),
          status: row.is_active ? 'Active' : 'Inactive',
          statusClass: row.is_active ? 'badge badge-soft-success' : 'badge badge-soft-danger',
          addedOn: formatAddedOn(row.created_at),
          originalData: row,
        }));

        setData(mapped);
        setMetadata(response.metadata || { total: mapped.length, page: 1, limit: 10 });
      } else {
        setData([]);
      }
    } catch (err) {
      console.error('Error fetching pickup points:', err);
      setError(err?.message ?? 'Failed to fetch pickup points');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchPickupPoints();
  }, [fetchPickupPoints]);

  const handlePageChange = (page, pageSize) => {
    setParams(prev => ({ ...prev, page, limit: pageSize }));
  };

  const handleTableChange = (pagination, filters, sorter) => {
    if (sorter && sorter.field) {
      setParams(prev => ({
        ...prev,
        sortField: sorter.field === 'pickupPoint' ? 'point_name' :
          sorter.field === 'routeName' ? 'route_name' :
            sorter.field === 'status' ? 'is_active' :
              sorter.field,
        sortOrder: sorter.order === 'descend' ? 'DESC' : 'ASC',
        page: 1
      }));
    }
  };

  return {
    data,
    loading,
    error,
    metadata,
    params,
    setParams,
    refetch: fetchPickupPoints,
    handlePageChange,
    handleTableChange
  };
};
