import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

export const useDesignations = () => {
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDesignations = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiService.getDesignations();

      if (response.status === 'SUCCESS') {
        const transformedData = response.data.map((desig, index) => {
          const id =
            desig.designation_code ||
            (desig.id != null ? `DS${desig.id}` : `DS${index + 1}`);

          const designationName =
            desig.designation_name ||
            desig.designation ||
            desig.name ||
            'N/A';

          const status =
            desig.is_active === true
              ? 'Active'
              : desig.is_active === false
              ? 'Inactive'
              : (desig.status === 'Active' || desig.status === 'Inactive')
              ? desig.status
              : 'Active';

          return {
            key: desig.id != null ? String(desig.id) : String(index + 1),
            id,
            designation: designationName,
            status,
            originalData: desig, // Store original data for edit modal
          };
        });

        setDesignations(transformedData);
      } else {
        setError('Failed to fetch designations data');
      }
    } catch (err) {
      console.error('Error fetching designations:', err);
      setError(err.message || 'Failed to fetch designations data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDesignations();
  }, []);

  return {
    designations,
    loading,
    error,
    refetch: fetchDesignations,
  };
};
