import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

export const useStaff = () => {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiService.getStaff();

      if (response.status === 'SUCCESS') {
        const transformedData = response.data.map((staff, index) => {
          const id =
            staff.employee_code ||
            (staff.id != null ? String(staff.id) : `S${index + 1}`);

          const name = `${staff.first_name || ''} ${staff.last_name || ''}`
            .trim() || 'N/A';

          // Department name from JOIN (department_name or department)
          const department =
            staff.department_name ||
            staff.department ||
            staff.dept_name ||
            'N/A';

          // Designation name from JOIN (designation_name or designation)
          const designation =
            staff.designation_name ||
            staff.designation ||
            staff.title ||
            'N/A';

          const phone = staff.phone || 'N/A';
          const email = staff.email || 'N/A';

          const joiningRaw =
            staff.joining_date || staff.date_of_join || staff.date_of_joining;

          const dateOfJoin = joiningRaw
            ? new Date(joiningRaw).toLocaleDateString('en-GB')
            : 'N/A';

          const img =
            staff.photo_url ||
            staff.profile_image ||
            'assets/img/profiles/avatar-27.jpg';

          return {
            key: staff.id != null ? String(staff.id) : String(index + 1),
            id,
            name,
            department,
            designation,
            phone,
            email,
            dateOfJoin,
            img,
            originalData: staff, // Store original data for edit modal
          };
        });

        setStaffList(transformedData);
      } else {
        setError('Failed to fetch staff data');
      }
    } catch (err) {
      console.error('Error fetching staff:', err);
      setError(err.message || 'Failed to fetch staff data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  return {
    staffList,
    loading,
    error,
    refetch: fetchStaff,
  };
};

