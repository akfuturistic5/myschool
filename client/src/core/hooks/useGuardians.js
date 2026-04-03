import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { apiService } from '../services/apiService';
import { selectUser } from '../data/redux/authSlice';

/**
 * @param {Object} options
 * @param {number|null} [options.academicYearId] - When set (headmaster), only guardians whose student is in this academic year
 */
export const useGuardians = (options = {}) => {
  const { academicYearId = null } = options;
  const [guardians, setGuardians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const user = useSelector(selectUser);
  const role = (user?.role || '').trim();
  const isGuardian = role.toLowerCase() === 'guardian';

  const transformGuardian = (guardian) => ({
    key: guardian.id,
    id: guardian.id,
    name: `${guardian.first_name || ''} ${guardian.last_name || ''}`.trim() || 'N/A',
    Addedon: guardian.created_at ? `Added on ${new Date(guardian.created_at).toLocaleDateString('en-GB')}` : 'Added on 25 Mar 2024',
    Child: `${guardian.student_first_name || ''} ${guardian.student_last_name || ''}`.trim() || 'N/A',
    class: `${guardian.class_name || ''}, ${guardian.section_name || ''}`.replace(/^,\s*/, '').replace(/,\s*$/, '') || 'N/A',
    phone: guardian.phone || 'N/A',
    email: guardian.email || 'N/A',
    GuardianImage: "assets/img/guardians/guardian-01.jpg",
    ChildImage: "assets/img/students/student-01.jpg",
    student_admission_number: guardian.admission_number,
    student_roll_number: guardian.roll_number,
    guardian_type: guardian.guardian_type,
    relation: guardian.relation,
    occupation: guardian.occupation,
    student_id: guardian.student_id
  });

  const fetchGuardians = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = isGuardian
        ? await apiService.getCurrentGuardian()
        : await apiService.getGuardians({ academicYearId });
      if (response.status === 'SUCCESS') {
        const raw = response.data || [];
        const data = Array.isArray(raw) ? raw : [raw];
        const transformedData = data.map(transformGuardian);
        setGuardians(transformedData);
      } else {
        setError('Failed to fetch guardians data');
      }
    } catch (err) {
      console.error('Error fetching guardians:', err);
      setError(err.message || 'Failed to fetch guardians data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuardians();
  }, [isGuardian, academicYearId]);

  return {
    guardians,
    loading,
    error,
    refetch: fetchGuardians
  };
};
