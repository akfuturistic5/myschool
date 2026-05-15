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
      const rows = await Promise.all(raw.map(async (r, idx) => {
        const amount = parseFloat(r.amount ?? r.total_assigned ?? 0) || 0;
        const paid = parseFloat(r.paid ?? r.total_paid ?? 0) || 0;
        const balRaw = r.balance != null ? parseFloat(r.balance) : NaN;
        const balance = Number.isFinite(balRaw) ? Math.max(balRaw, 0) : Math.max(amount - paid, 0);
        /** Match list API CASE + UI filter options (Title Case) */
        let statusText = 'Unpaid';
        if (balance <= 0 && amount > 0) statusText = 'Paid';
        else if (paid > 0 && balance > 0) statusText = 'Partial';
        else if (amount <= 0 && paid <= 0) statusText = 'No Fees';
        const last = r.last_payment_date;
        const rawStudentImage = r.studentImage || r.photo_url || '';
        const studentImage = rawStudentImage ? await apiService.resolveAvatarUrl(rawStudentImage) : '';
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
          studentImage: studentImage || 'assets/img/profiles/avatar-27.jpg',
          amount,
          totalPaid: paid,
          balance,
          status: statusText,
          lastPaymentRaw: last ? dayjs(last).format('YYYY-MM-DD') : '',
          dueDate: r.due_date ? dayjs(r.due_date).format('DD MMM YYYY') : '-',
          lastDate: r.due_date ? dayjs(r.due_date).format('DD MMM YYYY') : '-', // Keep lastDate for compat or rename
          statusClass:
            statusText === 'Paid'
              ? 'badge badge-soft-success'
              : statusText === 'Partial'
                ? 'badge badge-soft-warning'
                : 'badge badge-soft-danger',
          view: statusText === 'Paid' ? 'View Details' : 'Collect Fees',
        };
      }));
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
