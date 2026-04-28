import { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '../services/apiService';

const EMPTY_PARAMS = Object.freeze({});

export const useTransportFees = (params = EMPTY_PARAMS) => {
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const paramsKey = JSON.stringify(params === EMPTY_PARAMS ? {} : params);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [metadata, setMetadata] = useState({
    totalCount: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  });

  const fetchFees = useCallback(async (overrides = {}) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getTransportFees({ ...paramsRef.current, ...overrides });
      if (response?.status === 'SUCCESS') {
        const list = response.data || [];
        const mapped = list.map((row, index) => ({
          key: String(row.id || index + 1),
          id: row.id,
          displayId: `TFM-${String(row.id).padStart(4, '0')}`,
          pickupPointName: row.point_name || 'N/A',
          planName: row.plan_name || 'N/A',
          durationDays: row.duration_days ?? '-',
          studentAmount: Number(row.amount || 0),
          staffAmount: Number(row.staff_amount || 0),
          status: row.status || 'Active',
          originalData: row,
        }));
        setData(mapped);
        const nextMeta = response.metadata || {
          totalCount: Number(response.totalCount ?? mapped.length ?? 0),
          page: Number(response.page ?? paramsRef.current?.page ?? 1),
          limit: Number(response.limit ?? paramsRef.current?.limit ?? 10),
          totalPages: Number(
            response.totalPages ??
              Math.ceil(
                Number(response.totalCount ?? mapped.length ?? 0) /
                  Math.max(1, Number(response.limit ?? paramsRef.current?.limit ?? 10))
              )
          ),
        };
        setMetadata(nextMeta);
      } else {
        setData([]);
      }
    } catch (err) {
      console.error('Error fetching transport fees:', err);
      setError(err?.message || 'Failed to fetch transport fees');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [paramsKey]);

  useEffect(() => {
    fetchFees();
  }, [fetchFees]);

  return {
    data,
    loading,
    error,
    metadata,
    refetch: fetchFees,
  };
};
