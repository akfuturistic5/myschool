-- Allow section_id to be NULL to support Class-level assignments
ALTER TABLE public.class_sections ALTER COLUMN section_id DROP NOT NULL;

-- Update the unique index to handle NULL values for section_id
DROP INDEX IF EXISTS public.uq_active_class_section;

-- Use COALESCE in a unique index to treat multiple NULLs as the same "Class-Level" assignment
-- -1 is used as a sentinel for "No Section"
CREATE UNIQUE INDEX uq_active_class_section_with_null 
ON public.class_sections (class_id, COALESCE(section_id, -1), academic_year_id) 
WHERE deleted_at IS NULL;
