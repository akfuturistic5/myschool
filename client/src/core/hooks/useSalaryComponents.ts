import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';

export interface SalaryComponent {
  id: number;
  component_name: string;
  type: 'earning' | 'allowance' | 'deduction';
  description?: string;
  status: 'Active' | 'Inactive';
}

export const useSalaryComponents = () => {
  const [salaryComponents, setSalaryComponents] = useState<SalaryComponent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchComponents = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.getSalaryComponents();
      if (response && response.status === 'SUCCESS') {
        setSalaryComponents(response.data || []);
      } else {
        setError(response?.message || 'Failed to fetch salary components');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching salary components');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComponents();
  }, [fetchComponents]);

  return { salaryComponents, loading, error, refresh: fetchComponents };
};
