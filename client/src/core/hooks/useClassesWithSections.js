import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService.js';

/** Normalize list endpoints: `{ data: T[] }`, bare `T[]`, or null. */
const asArray = (response) => {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data)) return response.data;
  return [];
};

export const useClassesWithSections = () => {
  const [classesWithSections, setClassesWithSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchClassesWithSections = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch classes, sections, and subjects
      const [classesResponse, sectionsResponse, subjectsResponse] = await Promise.all([
        apiService.getClasses(),
        apiService.getSections(),
        apiService.getSubjects()
      ]);
      
      const classes = asArray(classesResponse);
      const sections = asArray(sectionsResponse);
      const subjects = asArray(subjectsResponse);
      
      // Build subject count per class (subjects have class_id)
      const subjectCountByClass = {};
      subjects.forEach(sub => {
        const cid = sub.class_id;
        if (cid) subjectCountByClass[cid] = (subjectCountByClass[cid] || 0) + 1;
      });
      
      const combinedData = [];
      
      classes.forEach(classItem => {
        const classSections = sections.filter(section => section.class_id === classItem.id);
        const classTeacherName = `${classItem.teacher_first_name || ''} ${classItem.teacher_last_name || ''}`.trim();
        const classTotalStudents = Number.isFinite(Number(classItem.no_of_students))
          ? Number(classItem.no_of_students)
          : null;
        
        if (classSections.length > 0) {
          classSections.forEach(section => {
            combinedData.push({
              classId: classItem.id,
              classCode: classItem.class_code,
              className: classItem.class_name,
              maxStudents: classItem.max_students,
              classFee: classItem.class_fee,
              classDescription: classItem.description,
              sectionId: section.id,
              sectionName: section.section_name,
              noOfStudents: section.no_of_students || 0,
              noOfSubjects: subjectCountByClass[classItem.id] || classItem.no_of_subjects || 0,
              classTotalStudents,
              status: section.is_active ? 'Active' : 'Inactive',
              classStatus: classItem.is_active,
              teacherFirstName: section.teacher_first_name,
              teacherLastName: section.teacher_last_name,
              classTeacherName,
              roomNumber: section.room_number,
              class_teacher_id: classItem.class_teacher_id ?? null,
              section_teacher_id: section.section_teacher_id ?? null,
            });
          });
        } else {
          combinedData.push({
            classId: classItem.id,
            classCode: classItem.class_code,
            className: classItem.class_name,
            maxStudents: classItem.max_students,
            classFee: classItem.class_fee,
            classDescription: classItem.description,
            sectionId: null,
            sectionName: 'N/A',
            noOfStudents: classItem.no_of_students || 0,
            noOfSubjects: subjectCountByClass[classItem.id] || classItem.no_of_subjects || 0,
            classTotalStudents,
            status: classItem.is_active ? 'Active' : 'Inactive',
            classStatus: classItem.is_active,
            teacherFirstName: classItem.teacher_first_name,
            teacherLastName: classItem.teacher_last_name,
            classTeacherName,
            roomNumber: null,
            class_teacher_id: classItem.class_teacher_id ?? null,
            section_teacher_id: null,
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
  }, []);

  return {
    classesWithSections,
    loading,
    error,
    refetch: fetchClassesWithSections,
  };
};
