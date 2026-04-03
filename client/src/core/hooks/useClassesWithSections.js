import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService.js';

export const useClassesWithSections = (academicYearId = null) => {
  const [classesWithSections, setClassesWithSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchClassesWithSections = async () => {
    try {
      setLoading(true);
      setError(null);

      const classesPromise = academicYearId
        ? apiService.getClassesByAcademicYear(academicYearId)
        : apiService.getClasses();

      // Fetch classes, sections, and subjects
      const [classesResponse, sectionsResponse, subjectsResponse] = await Promise.all([
        classesPromise,
        apiService.getSections(),
        apiService.getSubjects()
      ]);
      
      const classes = classesResponse.data || [];
      const sections = sectionsResponse.data || [];
      const subjects = subjectsResponse.data || [];
      
      // Build subject count per class (subjects have class_id)
      const subjectCountByClass = {};
      subjects.forEach(sub => {
        const cid = sub.class_id;
        if (cid) subjectCountByClass[cid] = (subjectCountByClass[cid] || 0) + 1;
      });
      
      const combinedData = [];
      
      classes.forEach(classItem => {
        const noOfSubjects = subjectCountByClass[classItem.id] || 0;
        const classSections = sections.filter(section => section.class_id === classItem.id);
        
        if (classSections.length > 0) {
          classSections.forEach(section => {
            combinedData.push({
              classId: classItem.id,
              classCode: classItem.class_code,
              className: classItem.class_name,
              sectionId: section.id,
              sectionName: section.section_name,
              noOfStudents: section.no_of_students || 0,
              noOfSubjects,
              status: section.is_active ? 'Active' : 'Inactive',
              classStatus: classItem.is_active,
              teacherFirstName: section.teacher_first_name,
              teacherLastName: section.teacher_last_name,
              roomNumber: section.room_number
            });
          });
        } else {
          combinedData.push({
            classId: classItem.id,
            classCode: classItem.class_code,
            className: classItem.class_name,
            sectionId: null,
            sectionName: 'N/A',
            noOfStudents: classItem.no_of_students || 0,
            noOfSubjects,
            status: classItem.is_active ? 'Active' : 'Inactive',
            classStatus: classItem.is_active,
            teacherFirstName: classItem.teacher_first_name,
            teacherLastName: classItem.teacher_last_name,
            roomNumber: null
          });
        }
      });
      
      setClassesWithSections(combinedData);
    } catch (err) {
      console.error('Error fetching classes with sections:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch classes with sections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassesWithSections();
  }, [academicYearId]);

  return {
    classesWithSections,
    loading,
    error,
    refetch: fetchClassesWithSections,
  };
};
