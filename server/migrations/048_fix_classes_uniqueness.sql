
-- Loosen the global unique constraint on class_code to allow reuse in different academic years.
-- This resolves the "Class already exists" error when adding classes in a new session year.

ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_class_code_key;

-- Add composite unique constraint for (class_code, academic_year_id)
-- Note: NULL class_code values will not conflict with each other in Postgres.
ALTER TABLE public.classes ADD CONSTRAINT classes_class_code_academic_year_key UNIQUE (class_code, academic_year_id);
