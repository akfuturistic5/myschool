import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

export const usePayroll = (staffId?: number) => {
  const [payrollData, setPayrollData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPayroll = async () => {
    try {
      setLoading(true);
      // If staffId is provided, we might want to fetch individual payroll, 
      // but for now let's assume global list or filtered list
      const response = await apiService.getPayrollList();
      if (response && response.status === 'SUCCESS') {
        setPayrollData(response.data || []);
      } else {
        setError(response?.message || 'Failed to fetch payroll data');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching payroll data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayroll();
  }, [staffId]);

  return { payrollData, loading, error, refresh: fetchPayroll };
};
