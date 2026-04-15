import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';

function formatDate(val) {
  if (!val) return 'N/A';
  const d = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(d.getTime())) return 'N/A';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export const useNoticeBoard = (options = {}) => {
  const { limit = 100 } = options;
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNotices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.getNoticeBoard({ limit });
      if (res.status === 'SUCCESS' && Array.isArray(res.data)) {
        setNotices(
          res.data.map((r) => ({
            id: r.id,
            title: r.title || '',
            content: r.content || '',
            messageTo: r.messageTo || r.message_to || 'All',
            addedOn: r.addedOn || formatDate(r.created_at),
            modifiedOn: r.modifiedOn || formatDate(r.modified_at),
            created_at: r.created_at,
            modified_at: r.modified_at,
          }))
        );
      } else {
        setNotices([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch notices');
      setNotices([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  return { notices, loading, error, refetch: fetchNotices };
};
