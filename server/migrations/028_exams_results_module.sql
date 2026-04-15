-- =============================================================================
-- Migration: 028_exams_results_module.sql
-- Recreates Exams & Results after 025_remove_exams_results_module.sql.
-- Design: one exam can span multiple classes (exam_classes); timetable and
-- marks are scoped by class_id + section_id; section teacher manages timetable/marks.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.exams (
  id serial PRIMARY KEY,
  exam_name character varying(150) NOT NULL,
  exam_type character varying(30) NOT NULL,
  academic_year_id integer REFERENCES public.academic_years(id) ON DELETE SET NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by integer REFERENCES public.users(id) ON DELETE SET NULL,
  modified_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT exams_exam_type_check CHECK (
    (exam_type)::text = ANY (
      ARRAY[
        ('unit_test'::character varying)::text,
        ('monthly'::character varying)::text,
        ('quarterly'::character varying)::text,
        ('half_yearly'::character varying)::text,
        ('annual'::character varying)::text,
        ('preboard'::character varying)::text,
        ('internal'::character varying)::text,
        ('other'::character varying)::text
      ]
    )
  )
);

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS is_finalized boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS finalized_at timestamp without time zone,
  ADD COLUMN IF NOT EXISTS finalized_by integer;

-- Legacy schema compatibility: old exams table had NOT NULL start/end dates.
-- Exam creation in this module does not require schedule dates at create step.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'exams'
      AND column_name = 'start_date'
  ) THEN
    ALTER TABLE public.exams
      ALTER COLUMN start_date DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'exams'
      AND column_name = 'end_date'
  ) THEN
    ALTER TABLE public.exams
      ALTER COLUMN end_date DROP NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'exams_finalized_by_fkey'
  ) THEN
    ALTER TABLE public.exams
      ADD CONSTRAINT exams_finalized_by_fkey
      FOREIGN KEY (finalized_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_exams_finalized
  ON public.exams (is_finalized, academic_year_id);

CREATE TABLE IF NOT EXISTS public.exam_classes (
  exam_id integer NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  class_id integer NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  PRIMARY KEY (exam_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_classes_class_id ON public.exam_classes (class_id);
CREATE INDEX IF NOT EXISTS idx_exam_classes_exam_id ON public.exam_classes (exam_id);

CREATE TABLE IF NOT EXISTS public.exam_subjects (
  id serial PRIMARY KEY,
  exam_id integer NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  class_id integer NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  section_id integer NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  subject_id integer NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  max_marks numeric(7,2) NOT NULL CHECK (max_marks > 0),
  passing_marks numeric(7,2) NOT NULL CHECK (passing_marks >= 0),
  exam_date date,
  start_time time without time zone,
  end_time time without time zone,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by integer REFERENCES public.users(id) ON DELETE SET NULL,
  modified_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT exam_subjects_marks_check CHECK (passing_marks <= max_marks),
  CONSTRAINT exam_subjects_time_order CHECK (
    start_time IS NULL OR end_time IS NULL OR end_time > start_time
  ),
  CONSTRAINT exam_subjects_exam_class_section_subject_key UNIQUE (exam_id, class_id, section_id, subject_id)
);

-- Legacy-safe upgrades: if older exam_subjects table exists, backfill missing columns.
ALTER TABLE public.exam_subjects
  ADD COLUMN IF NOT EXISTS class_id integer,
  ADD COLUMN IF NOT EXISTS section_id integer,
  ADD COLUMN IF NOT EXISTS exam_date date,
  ADD COLUMN IF NOT EXISTS start_time time without time zone,
  ADD COLUMN IF NOT EXISTS end_time time without time zone,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by integer,
  ADD COLUMN IF NOT EXISTS modified_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exam_subjects_class_id_fkey'
  ) THEN
    ALTER TABLE public.exam_subjects
      ADD CONSTRAINT exam_subjects_class_id_fkey
      FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exam_subjects_section_id_fkey'
  ) THEN
    ALTER TABLE public.exam_subjects
      ADD CONSTRAINT exam_subjects_section_id_fkey
      FOREIGN KEY (section_id) REFERENCES public.sections(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exam_subjects_exam_class_section_subject_key'
  ) THEN
    ALTER TABLE public.exam_subjects
      ADD CONSTRAINT exam_subjects_exam_class_section_subject_key
      UNIQUE (exam_id, class_id, section_id, subject_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_exam_subjects_exam ON public.exam_subjects (exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_subjects_class_section ON public.exam_subjects (class_id, section_id);
CREATE INDEX IF NOT EXISTS idx_exam_subjects_subject ON public.exam_subjects (subject_id);

-- Ensure every (exam_id, class_id) used by exam_subjects is present in exam_classes.
INSERT INTO public.exam_classes (exam_id, class_id)
SELECT DISTINCT es.exam_id, es.class_id
FROM public.exam_subjects es
LEFT JOIN public.exam_classes ec
  ON ec.exam_id = es.exam_id AND ec.class_id = es.class_id
WHERE es.class_id IS NOT NULL
  AND ec.exam_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'exam_subjects_exam_class_fkey'
  ) THEN
    ALTER TABLE public.exam_subjects
      ADD CONSTRAINT exam_subjects_exam_class_fkey
      FOREIGN KEY (exam_id, class_id)
      REFERENCES public.exam_classes (exam_id, class_id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.exam_results (
  id serial PRIMARY KEY,
  exam_id integer NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id integer NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id integer NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  exam_subject_id integer REFERENCES public.exam_subjects(id) ON DELETE SET NULL,
  marks_obtained numeric(7,2),
  grade character varying(10),
  remarks text,
  is_absent boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by integer REFERENCES public.users(id) ON DELETE SET NULL,
  modified_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  entered_by integer REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT exam_results_absent_marks_check CHECK (
    (NOT is_absent) OR (marks_obtained IS NULL)
  ),
  CONSTRAINT exam_results_exam_student_subject_key UNIQUE (exam_id, student_id, subject_id)
);

-- Legacy-safe upgrades: older exam_results may miss these columns.
ALTER TABLE public.exam_results
  ADD COLUMN IF NOT EXISTS exam_subject_id integer,
  ADD COLUMN IF NOT EXISTS marks_obtained numeric(7,2),
  ADD COLUMN IF NOT EXISTS grade character varying(10),
  ADD COLUMN IF NOT EXISTS remarks text,
  ADD COLUMN IF NOT EXISTS is_absent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by integer,
  ADD COLUMN IF NOT EXISTS entered_by integer,
  ADD COLUMN IF NOT EXISTS modified_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exam_results_exam_subject_id_fkey'
  ) THEN
    ALTER TABLE public.exam_results
      ADD CONSTRAINT exam_results_exam_subject_id_fkey
      FOREIGN KEY (exam_subject_id) REFERENCES public.exam_subjects(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exam_results_exam_student_subject_key'
  ) THEN
    ALTER TABLE public.exam_results
      ADD CONSTRAINT exam_results_exam_student_subject_key
      UNIQUE (exam_id, student_id, subject_id);
  END IF;
END $$;

UPDATE public.exam_results
SET marks_obtained = 0
WHERE is_absent = true
  AND COALESCE(marks_obtained, 0) <> 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exam_results_absent_marks_check'
  ) THEN
    ALTER TABLE public.exam_results
      DROP CONSTRAINT exam_results_absent_marks_check;
  END IF;
  ALTER TABLE public.exam_results
    ADD CONSTRAINT exam_results_absent_marks_check
    CHECK ((NOT is_absent) OR COALESCE(marks_obtained, 0) = 0);
END $$;

CREATE INDEX IF NOT EXISTS idx_exam_results_student_exam ON public.exam_results (student_id, exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_exam ON public.exam_results (exam_id);

COMMIT;
