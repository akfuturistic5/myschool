BEGIN;

-- Enforce exam uniqueness at DB level to prevent race-condition duplicates.
-- This matches createExam duplicate-check semantics.
CREATE UNIQUE INDEX IF NOT EXISTS uq_exams_class_section_year_name_type_dates
ON public.exams (
  class_id,
  COALESCE(section_id, 0),
  COALESCE(academic_year_id, 0),
  lower(trim(exam_name)),
  COALESCE(exam_type, ''),
  start_date,
  end_date
);

COMMIT;
