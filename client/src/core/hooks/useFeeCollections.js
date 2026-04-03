import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

export function useFeeCollections(options = {}) {
  const { academicYearId } = options;
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.getFeeCollectionsList({ academicYearId });
      if (res?.status === 'SUCCESS' && Array.isArray(res.data)) {
        const rows = res.data.map((r, idx) => ({
          key: String(r.id ?? idx),
          id: r.id,
          admNo: r.admNo || '',
          rollNo: r.rollNo || '',
          student: r.student || '',
          studentClass: r.class && r.section ? `${r.class}, ${r.section}` : (r.class || r.section || ''),
          class: r.class || '',
          section: r.section || '',
          studentImage: r.studentImage || 'assets/img/students/student-01.jpg',
          amount: r.amount || '0',
          lastDate: '-',
          status: r.status || 'Unpaid',
          statusClass: r.status === 'Paid' ? 'badge badge-soft-success' : 'badge badge-soft-danger',
          view: r.status === 'Paid' ? 'View Details' : 'Collect Fees',
        }));
        setData(rows);
      } else {
        setData([]);
      }
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
