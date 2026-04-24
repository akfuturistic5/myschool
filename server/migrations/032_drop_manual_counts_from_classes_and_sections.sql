-- Remove redundant manual count columns from classes and sections.
-- These are now calculated dynamically in the controllers.

-- 1) Classes table
ALTER TABLE public.classes 
  DROP COLUMN IF EXISTS no_of_students;

-- 2) Sections table
ALTER TABLE public.sections
  DROP COLUMN IF EXISTS no_of_students;

-- 3) Drop legacy trigger that depends on these columns
DROP TRIGGER IF EXISTS trg_update_class_students ON public.sections;
DROP FUNCTION IF EXISTS public.update_class_students_count();

COMMENT ON TABLE public.classes IS 'Manual no_of_students removed in favor of dynamic subqueries.';
COMMENT ON TABLE public.sections IS 'Manual no_of_students removed in favor of dynamic subqueries.';
