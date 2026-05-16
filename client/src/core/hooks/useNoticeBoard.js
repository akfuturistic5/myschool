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
  const { limit = 100, includeExpired = false, academicYearId = null } = options;
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchNotices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.getNoticeBoard({
        limit,
        include_expired: includeExpired ? 'true' : undefined,
        academic_year_id: academicYearId,
      });
      if (res.status === 'SUCCESS' && Array.isArray(res.data)) {
        setNotices(
          res.data.map((r) => ({
            id: r.id,
            title: r.title || '',
            content: r.content || '',
            messageTo: r.messageTo || r.message_to || 'All',
            notice_start_date: r.notice_start_date || null,
            notice_end_date: r.notice_end_date || null,
            noticeStartDate: r.noticeStartDate || formatDate(r.notice_start_date),
            noticeEndDate: r.noticeEndDate || formatDate(r.notice_end_date),
            publishOn: r.publishOn || formatDate(r.created_at),
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
  }, [limit, includeExpired, academicYearId]);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  const createNotice = useCallback(async (payload) => {
    setSaving(true);
    try {
      const res = await apiService.createNotice(payload);
      await fetchNotices();
      return res;
    } finally {
      setSaving(false);
    }
  }, [fetchNotices]);

  const updateNotice = useCallback(async (id, payload) => {
    setSaving(true);
    try {
      const res = await apiService.updateNotice(id, payload);
      await fetchNotices();
      return res;
    } finally {
      setSaving(false);
    }
  }, [fetchNotices]);

  const deleteNotice = useCallback(async (id) => {
    setSaving(true);
    try {
      const res = await apiService.deleteNotice(id);
      await fetchNotices();
      return res;
    } finally {
      setSaving(false);
    }
  }, [fetchNotices]);

  return {
    notices,
    loading,
    error,
    saving,
    refetch: fetchNotices,
    createNotice,
    updateNotice,
    deleteNotice,
  };
};
