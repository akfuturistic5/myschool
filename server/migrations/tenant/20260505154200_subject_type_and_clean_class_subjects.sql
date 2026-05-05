-- XOR Subject Type and Curriculum Cleanup
-- 1. Add strictly XOR type to Master subjects
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS subject_type character varying(50) DEFAULT 'Theory';

-- 2. Clean up curriculum mapping (removing marks and hours entirely)
ALTER TABLE public.class_subjects DROP COLUMN IF EXISTS total_marks;
ALTER TABLE public.class_subjects DROP COLUMN IF EXISTS passing_marks;
ALTER TABLE public.class_subjects DROP COLUMN IF EXISTS practical_hours;
ALTER TABLE public.class_subjects DROP COLUMN IF EXISTS theory_hours;
