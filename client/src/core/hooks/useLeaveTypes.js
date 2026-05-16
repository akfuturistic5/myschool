import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

export const useLeaveTypes = (options = {}) => {
  const applicableFor = options?.applicableFor || null;
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLeaveTypes = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.getLeaveTypes({
        applicable_for: applicableFor || undefined,
      });
      if (res?.status === 'SUCCESS' && Array.isArray(res.data)) {
        let filteredData = res.data;
        if (applicableFor) {
          filteredData = res.data.filter(lt => 
            lt.applicable_for === applicableFor || lt.applicable_for === 'both'
          );
        }
        setLeaveTypes(
          filteredData.map((lt) => ({
            value: String(lt.id),
            label: lt.leave_type || lt.leave_type_name || 'Leave',
            id: lt.id,
            max_days_per_year: lt.max_days_per_year,
            max_days: lt.max_days,
            applicable_for: lt.applicable_for || 'both',
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
  }, [applicableFor]);

  return { leaveTypes, loading, error, refetch: fetchLeaveTypes };
};
