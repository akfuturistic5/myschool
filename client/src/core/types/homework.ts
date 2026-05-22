export type HomeworkListItem = {
  key: string;
  id: number;
  title: string;
  class: string;
  section: string;
  subject: string;
  homeworkDate: string;
  submissionDate: string;
  status: string;
  createdBy: string;
  homeworkType: string;
  recipientCount: number;
  submittedCount: number;
  pendingEvaluationCount: number;
  originalData: Record<string, unknown>;
};

export type HomeworkListFilters = {
  academic_year_id?: number | null;
  class_id?: number | null;
  class_section_id?: number | null;
  class_subject_id?: number | null;
  status?: string | null;
  page?: number;
  limit?: number;
};

export type SubjectAssignmentOption = {
  id: number;
  teacherId: number;
  classId: number;
  classSectionId: number;
  classSubjectId: number;
  academicYearId: number;
  className: string;
  sectionName: string;
  subjectName: string;
  label: string;
};
