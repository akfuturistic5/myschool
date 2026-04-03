import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

/**
 * @param {Object} options
 * @param {boolean} [options.forCurrentUser=false] - When true (e.g. Parent role), fetches only logged-in parent's data
 * @param {number|null} [options.academicYearId] - When set (headmaster), only parents whose student is in this academic year
 * @param {boolean} [options.enabled=true] - When false, skips fetching
 */
export const useParents = (options = {}) => {
  const { forCurrentUser = false, academicYearId = null, enabled = true } = options;
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchParents = async () => {
    if (!enabled) {
      setParents([]);
      setError(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = forCurrentUser
        ? await apiService.getMyParents()
        : await apiService.getParents({ academicYearId });
      if (response && response.status === 'SUCCESS') {
        const rawData = Array.isArray(response.data) ? response.data : [];
        const transformedData = rawData.map((parent) => {
          if (!parent || typeof parent !== 'object') return null;
          let addedon = 'N/A';
          try {
            if (parent.created_at) {
              addedon = `Added on ${new Date(parent.created_at).toLocaleDateString('en-GB')}`;
            }
          } catch (_) {}
          return {
          key: parent.id,
          id: parent.id,
          name: parent.father_name || 'N/A',
          Addedon: addedon,
          Child: `${parent.student_first_name || ''} ${parent.student_last_name || ''}`.trim() || 'N/A',
          class: `${parent.class_name || ''}, ${parent.section_name || ''}`.replace(/^,\s*/, '').replace(/,\s*$/, '') || 'N/A',
          class_name: parent.class_name || null,
          section_name: parent.section_name || null,
          phone: parent.father_phone || 'N/A',
          email: parent.father_email || 'N/A',
          ParentImage: "assets/img/parents/parent-01.jpg",
          ChildImage: "assets/img/students/student-01.jpg",
          student_admission_number: parent.admission_number,
          student_roll_number: parent.roll_number,
          mother_name: parent.mother_name,
          mother_email: parent.mother_email,
          mother_phone: parent.mother_phone,
          father_occupation: parent.father_occupation,
          mother_occupation: parent.mother_occupation,
          student_id: parent.student_id
        };
        }).filter(Boolean);
        setParents(transformedData);
      } else {
        setError('Failed to fetch parents data');
      }
    } catch (err) {
      console.error('Error fetching parents:', err);
      setError(err.message || 'Failed to fetch parents data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParents();
  }, [forCurrentUser, academicYearId, enabled]);

  return {
    parents,
    loading,
    error,
    refetch: fetchParents
  };
};
