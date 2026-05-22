import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

const EMPTY_CATEGORY = { used: 0, limit: 0, available: 0 };

const normalizeCategory = (raw) => {
  const used = Number(raw?.used ?? 0);
  const limit = Number(raw?.limit ?? 0);
  const available = Number.isFinite(Number(raw?.available))
    ? Number(raw.available)
    : limit > 0
      ? Math.max(limit - used, 0)
      : 0;
  return {
    used: Number.isFinite(used) && used >= 0 ? used : 0,
    limit: Number.isFinite(limit) && limit >= 0 ? limit : 0,
    available: Number.isFinite(available) && available >= 0 ? available : 0,
  };
};

/**
 * Parent Dashboard leave cards: approved days used + remaining allowance per category.
 * Backed by GET /leave-applications/parent-children/summary (same scoping as parent-children list).
 */
export const useParentLeaveSummary = (studentId = null) => {
  const [summary, setSummary] = useState({
    medical: { ...EMPTY_CATEGORY },
    casual: { ...EMPTY_CATEGORY },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchSummary = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getParentChildrenLeaveSummary({
          student_id: studentId != null ? studentId : undefined,
        });
        if (cancelled) return;
        if (res?.status === 'SUCCESS' && res?.data) {
          const data = res.data;
          setSummary({
            medical: normalizeCategory(data.medical),
            casual: normalizeCategory(data.casual),
          });
        } else {
          setSummary({
            medical: { ...EMPTY_CATEGORY },
            casual: { ...EMPTY_CATEGORY },
          });
        }
      } catch (err) {
        if (cancelled) return;
        setError(err?.message || 'Failed to fetch leave summary');
        setSummary({
          medical: { ...EMPTY_CATEGORY },
          casual: { ...EMPTY_CATEGORY },
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchSummary();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  return { summary, loading, error };
};
