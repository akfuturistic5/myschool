BEGIN;

-- Add section scope to exams while preserving existing rows.
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS section_id integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'exams_section_id_fkey'
  ) THEN
    ALTER TABLE public.exams
      ADD CONSTRAINT exams_section_id_fkey
      FOREIGN KEY (section_id) REFERENCES public.sections(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_exams_class_section_year
  ON public.exams (class_id, section_id, academic_year_id);

-- Subject-level exam structure (theory/practical + max/pass marks).
CREATE TABLE IF NOT EXISTS public.exam_subjects (
  id serial PRIMARY KEY,
  exam_id integer NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  subject_id integer NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  exam_component varchar(20) NOT NULL DEFAULT 'theory',
  max_marks numeric(7,2) NOT NULL CHECK (max_marks > 0),
  passing_marks numeric(7,2) NOT NULL CHECK (passing_marks >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by integer,
  modified_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT exam_subjects_component_check CHECK (exam_component IN ('theory', 'practical')),
  CONSTRAINT exam_subjects_marks_check CHECK (passing_marks <= max_marks),
  CONSTRAINT exam_subjects_exam_subject_component_key UNIQUE (exam_id, subject_id, exam_component)
);

CREATE INDEX IF NOT EXISTS idx_exam_subjects_exam ON public.exam_subjects (exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_subjects_subject ON public.exam_subjects (subject_id);

-- Extend exam_results to store stable per-entry marks metadata.
ALTER TABLE public.exam_results
  ADD COLUMN IF NOT EXISTS exam_subject_id integer,
  ADD COLUMN IF NOT EXISTS obtained_marks numeric(7,2),
  ADD COLUMN IF NOT EXISTS max_marks numeric(7,2),
  ADD COLUMN IF NOT EXISTS passing_marks numeric(7,2),
  ADD COLUMN IF NOT EXISTS entered_by integer;

UPDATE public.exam_results
SET obtained_marks = marks_obtained
WHERE obtained_marks IS NULL AND marks_obtained IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'exam_results_exam_subject_id_fkey'
  ) THEN
    ALTER TABLE public.exam_results
      ADD CONSTRAINT exam_results_exam_subject_id_fkey
      FOREIGN KEY (exam_subject_id) REFERENCES public.exam_subjects(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_exam_results_exam_student
  ON public.exam_results (exam_id, student_id);

CREATE INDEX IF NOT EXISTS idx_exam_results_exam_subject
  ON public.exam_results (exam_subject_id);

COMMIT;

