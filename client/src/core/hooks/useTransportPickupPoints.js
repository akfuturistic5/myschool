import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { transportPickup } from '../data/json/transport_pickup';

function formatAddedOn(createdAt) {
  if (!createdAt) return 'N/A';
  return new Date(createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const useTransportPickupPoints = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPickupPoints = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getTransportPickupPoints();
      const list = Array.isArray(response) ? response : (response?.data ?? []);
      if (Array.isArray(list)) {
        const mapped = list.map((row, index) => ({
          key: String(row.id ?? index + 1),
          id: row.pickup_code ?? String(row.id),
          pickupPoint: row.address ?? 'N/A',
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
      console.error('Error fetching pickup points:', err);
      setError(err?.message ?? 'Failed to fetch pickup points');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPickupPoints();
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchPickupPoints,
    fallbackData: transportPickup,
  };
};
