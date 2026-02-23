import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

export function useFeeStructures() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getFeeStructures();
        if (mounted && res?.status === 'SUCCESS' && Array.isArray(res.data)) {
          setData(res.data);
        } else if (mounted) {
          setData([]);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || 'Failed to fetch fee structures');
          setData([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return { feeStructures: data, loading, error };
}
