import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService.js';

/** Normalize list endpoints: `{ data: T[] }`, bare `T[]`, or null. */
const asArray = (response) => {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data)) return response.data;
  return [];
};

/**
 * @param {number|string|null|undefined} [academicYearId]
 */
export const useClassesWithSections = (academicYearId = null) => {
  const [classesWithSections, setClassesWithSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchClassesWithSections = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [summaryResponse, classesResponse, subjectsResponse] = await Promise.all([
        apiService.getClassSectionsSummary(academicYearId),
        apiService.getClasses(academicYearId),
        apiService.getSubjects(),
      ]);

      const summary = asArray(summaryResponse);
      const classes = asArray(classesResponse);
      const subjects = asArray(subjectsResponse);

      const classById = {};
      classes.forEach((classItem) => {
        classById[classItem.id] = classItem;
      });

      const subjectCountByClass = {};
      subjects.forEach((sub) => {
        const cid = sub.class_id;
        if (cid) subjectCountByClass[cid] = (subjectCountByClass[cid] || 0) + 1;
      });

      const classIds = summary.map((row) => row.id).filter((id) => id != null);
      const sectionDetailsByClass = {};

      await Promise.all(
        classIds.map(async (classId) => {
          try {
            const res = await apiService.getClassSections(classId, academicYearId);
            sectionDetailsByClass[classId] = asArray(res);
          } catch {
            sectionDetailsByClass[classId] = [];
          }
        })
      );

      const combinedData = [];

      summary.forEach((cls) => {
        const classItem = classById[cls.id] || cls;
        const sectionsList = Array.isArray(cls.sections) ? cls.sections : [];
        const detailedSections = sectionDetailsByClass[cls.id] || [];
        const detailBySectionId = {};
        detailedSections.forEach((d) => {
          if (d.section_id != null) detailBySectionId[d.section_id] = d;
        });

        const classTeacherName = `${classItem.teacher_first_name || ''} ${classItem.teacher_last_name || ''}`.trim();
        const classTotalStudents = Number.isFinite(Number(classItem.no_of_students))
          ? Number(classItem.no_of_students)
          : null;

        if (sectionsList.length > 0) {
          sectionsList.forEach((sec) => {
            const detail = detailBySectionId[sec.section_id] || {};
            combinedData.push({
              classId: cls.id,
              classCode: cls.class_code || classItem.class_code,
              className: cls.class_name || classItem.class_name,
              maxStudents: classItem.max_students,
              classFee: classItem.class_fee,
              classDescription: classItem.description,
              sectionId: sec.section_id,
              sectionName: sec.section_name || detail.section_name || '—',
              noOfStudents: Number(detail.no_of_students ?? 0),
              noOfSubjects: subjectCountByClass[cls.id] || classItem.no_of_subjects || 0,
              classTotalStudents,
              status: (detail.is_active ?? sec.is_active) ? 'Active' : 'Inactive',
              classStatus: classItem.is_active,
              teacherFirstName: detail.teacher_first_name,
              teacherLastName: detail.teacher_last_name,
              classTeacherName,
              roomNumber: detail.room_number || sec.room_number,
              class_teacher_id: classItem.class_teacher_id ?? null,
              section_teacher_id: detail.section_teacher_id ?? null,
              section_ids: classItem.section_ids || [],
            });
          });
        } else {
          combinedData.push({
            classId: cls.id,
            classCode: cls.class_code || classItem.class_code,
            className: cls.class_name || classItem.class_name,
            maxStudents: classItem.max_students,
            classFee: classItem.class_fee,
            classDescription: classItem.description,
            sectionId: null,
            sectionName: '—',
            noOfStudents: classItem.no_of_students || 0,
            noOfSubjects: subjectCountByClass[cls.id] || classItem.no_of_subjects || 0,
            classTotalStudents,
            status: classItem.is_active ? 'Active' : 'Inactive',
            classStatus: classItem.is_active,
            teacherFirstName: classItem.teacher_first_name,
            teacherLastName: classItem.teacher_last_name,
            classTeacherName,
            roomNumber: null,
            class_teacher_id: classItem.class_teacher_id ?? null,
            section_teacher_id: null,
            section_ids: classItem.section_ids || [],
          });
        }
      });

      setClassesWithSections(combinedData);
    } catch (err) {
      console.error('Error fetching classes with sections:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch classes with sections');
      setClassesWithSections([]);
    } finally {
      setLoading(false);
    }
  }, [academicYearId]);

  useEffect(() => {
    fetchClassesWithSections();
  }, [fetchClassesWithSections]);

  return {
    classesWithSections,
    loading,
    error,
    refetch: fetchClassesWithSections,
  };
};
