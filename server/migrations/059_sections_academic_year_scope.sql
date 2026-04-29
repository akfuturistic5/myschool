-- Add academic_year_id to sections for year-scoped data cloning/filtering.
-- Safe to re-run.

ALTER TABLE public.sections
  ADD COLUMN IF NOT EXISTS academic_year_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'sections'
      AND c.conname = 'sections_academic_year_id_fkey'
  ) THEN
    ALTER TABLE public.sections
      ADD CONSTRAINT sections_academic_year_id_fkey
      FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Backfill from linked class where missing.
UPDATE public.sections s
SET academic_year_id = c.academic_year_id
FROM public.classes c
WHERE s.class_id = c.id
  AND s.academic_year_id IS NULL
  AND c.academic_year_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sections_academic_year_id ON public.sections(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_sections_year_class_name
  ON public.sections(academic_year_id, class_id, section_name);
