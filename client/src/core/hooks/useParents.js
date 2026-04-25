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
          const resolvedName = parent.father_name || '';
          const resolvedEmail = parent.father_email || '';
          const resolvedPhone = parent.father_phone || '';
          const resolvedImage = parent.father_image_url || "assets/img/parents/parent-01.jpg";
          let addedon = 'N/A';
          try {
            if (parent.created_at) {
              addedon = `Added on ${new Date(parent.created_at).toLocaleDateString('en-GB')}`;
            }
          } catch (_) {}
          return {
          key: parent.id,
          id: parent.id,
          name: resolvedName,
          Addedon: addedon,
          Child: `${parent.student_first_name || ''} ${parent.student_last_name || ''}`.trim() || '',
          class: `${parent.class_name || ''}, ${parent.section_name || ''}`.replace(/^,\s*/, '').replace(/,\s*$/, '') || '',
          class_name: parent.class_name || null,
          section_name: parent.section_name || null,
          phone: resolvedPhone,
          email: resolvedEmail,
          ParentImage: resolvedImage,
          ChildImage: parent.student_image_url || "assets/img/students/student-01.jpg",
          student_admission_number: parent.admission_number,
          student_roll_number: parent.roll_number,
          mother_name: parent.mother_name,
          mother_email: parent.mother_email,
          mother_phone: parent.mother_phone,
          father_occupation: parent.father_occupation,
          mother_occupation: parent.mother_occupation,
          father_image_url: parent.father_image_url,
          mother_image_url: parent.mother_image_url,
          student_id: parent.student_id,
          /** From /parents/me — used when full GET /students/:id is slow or omits placement; same tenant RBAC. */
          class_id: parent.class_id != null ? Number(parent.class_id) : null,
          section_id: parent.section_id != null ? Number(parent.section_id) : null,
          academic_year_id: parent.academic_year_id != null ? Number(parent.academic_year_id) : null,
          father_user_id: parent.father_user_id != null ? Number(parent.father_user_id) : null,
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
