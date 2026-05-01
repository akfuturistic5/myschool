-- Fix legacy section->class student count trigger after dropping no_of_students columns.
-- Safe to re-run.

DO $$
BEGIN
  -- If either side dropped no_of_students, legacy trigger must not run.
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'classes'
      AND column_name = 'no_of_students'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sections'
      AND column_name = 'no_of_students'
  ) THEN
    DROP TRIGGER IF EXISTS trg_update_class_students ON public.sections;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_class_students_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Backward-compatible: only update manual aggregates when both columns exist.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'classes'
      AND column_name = 'no_of_students'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sections'
      AND column_name = 'no_of_students'
  ) THEN
    UPDATE public.classes
    SET no_of_students = (
      SELECT COALESCE(SUM(s.no_of_students), 0)
      FROM public.sections s
      WHERE s.class_id = COALESCE(NEW.class_id, OLD.class_id)
    )
    WHERE id = COALESCE(NEW.class_id, OLD.class_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
