-- =============================================================================
-- Migration: 031_exam_subjects_exam_class_integrity.sql
-- Purpose:
--   Enforce exam_subjects.class_id to be a class linked to the same exam_id via
--   exam_classes for already-migrated databases.
-- =============================================================================

BEGIN;

-- Backfill missing exam_classes links from existing exam_subjects rows.
INSERT INTO public.exam_classes (exam_id, class_id)
SELECT DISTINCT es.exam_id, es.class_id
FROM public.exam_subjects es
LEFT JOIN public.exam_classes ec
  ON ec.exam_id = es.exam_id
 AND ec.class_id = es.class_id
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

COMMIT;
