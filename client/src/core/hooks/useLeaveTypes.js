import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

export const useLeaveTypes = () => {
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLeaveTypes = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.getLeaveTypes();
      if (res?.status === 'SUCCESS' && Array.isArray(res.data)) {
        setLeaveTypes(
          res.data.map((lt) => ({
            value: String(lt.id),
            label: lt.leave_type || lt.leave_type_name || 'Leave',
          }))
        );
      } else {
        setLeaveTypes([]);
      }
    } catch (err) {
      setError(err?.message || 'Failed to fetch leave types');
      setLeaveTypes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  return { leaveTypes, loading, error, refetch: fetchLeaveTypes };
};
