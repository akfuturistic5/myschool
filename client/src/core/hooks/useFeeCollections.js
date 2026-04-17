import dayjs from 'dayjs';
import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

export function useFeeCollections(options = {}) {
  const { academicYearId } = options;
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    if (academicYearId == null || academicYearId === '') {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.getFeeCollectionsList({ academicYearId });
      const raw = Array.isArray(res?.data) ? res.data : [];
      const rows = raw.map((r, idx) => {
        const amount = parseFloat(r.amount ?? r.total_assigned ?? 0) || 0;
        const paid = parseFloat(r.paid ?? r.total_paid ?? 0) || 0;
        const balance = Math.max(amount - paid, 0);
        const statusText = r.status || (balance <= 0 && amount > 0 ? 'Paid' : paid > 0 ? 'Partial' : amount <= 0 ? 'No Fees' : 'Unpaid');
        const last = r.last_payment_date;
        return {
          key: String(r.id ?? idx),
          id: r.id,
          studentId: r.id,
          admNo: r.admNo || '',
          rollNo: r.rollNo || '',
          student: r.student || '',
          studentClass: r.class && r.section ? `${r.class}, ${r.section}` : (r.class || r.section || ''),
          class: r.class || '',
          section: r.section || '',
          studentImage: r.studentImage || r.photo_url || '',
          amount,
          totalPaid: paid,
          balance,
          status: statusText,
          lastPaymentRaw: last ? dayjs(last).format('YYYY-MM-DD') : '',
          lastDate: last ? dayjs(last).format('DD MMM YYYY') : '-',
          statusClass: statusText === 'Paid' ? 'badge badge-soft-success' : 'badge badge-soft-danger',
          view: statusText === 'Paid' ? 'View Details' : 'Collect Fees',
        };
      });
      setData(rows);
    } catch (err) {
      setError(err.message || 'Failed to fetch fee collections');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [academicYearId]);

  return { data, loading, error, refetch: fetchData };
}
