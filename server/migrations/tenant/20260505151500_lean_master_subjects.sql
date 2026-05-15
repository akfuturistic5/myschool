-- Lean Master Subjects: Move curriculum-specific columns to class_subjects
-- (Note: class_subjects already has these columns in the master schema.sql)

ALTER TABLE public.subjects DROP COLUMN IF EXISTS theory_hours;
ALTER TABLE public.subjects DROP COLUMN IF EXISTS practical_hours;
ALTER TABLE public.subjects DROP COLUMN IF EXISTS total_marks;
ALTER TABLE public.subjects DROP COLUMN IF EXISTS passing_marks;
