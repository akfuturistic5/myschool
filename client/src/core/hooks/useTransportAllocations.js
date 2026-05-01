import { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '../services/apiService';
import dayjs from 'dayjs';

const EMPTY_PARAMS = Object.freeze({});

const formatDate = (value) => (value ? dayjs(value).format('DD MMM YYYY') : '-');

export const useTransportAllocations = (params = EMPTY_PARAMS) => {
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

  const fetchAllocations = useCallback(async (overrides = {}) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getTransportAllocations({ ...paramsRef.current, ...overrides });
      if (response?.status === 'SUCCESS') {
        const list = response.data || [];
        const mapped = list.map((row, index) => ({
          key: String(row.id || index + 1),
          id: row.id,
          displayId: `TAL-${String(row.id).padStart(4, '0')}`,
          studentId: row.student_id ?? null,
          staffId: row.staff_id ?? null,
          userId: row.user_id,
          userName: row.user_name || `User ${row.user_id}`,
          userType: row.user_type,
          routeName: row.route_name || 'N/A',
          pickupPointName: row.point_name || 'N/A',
          vehicleNumber: row.vehicle_number || 'N/A',
          feePlan: row.assigned_fee_plan_name || 'N/A',
          planDays: row.assigned_fee_duration_days || null,
          feeAmount: Number(row.assigned_fee_amount || 0),
          isFree: Boolean(row.is_free),
          startDate: formatDate(row.start_date),
          endDate: formatDate(row.end_date),
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
      console.error('Error fetching transport allocations:', err);
      setError(err?.message || 'Failed to fetch transport allocations');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [paramsKey]);

  useEffect(() => {
    fetchAllocations();
  }, [fetchAllocations]);

  return {
    data,
    loading,
    error,
    metadata,
    refetch: fetchAllocations,
  };
};
