BEGIN;

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS is_finalized boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS finalized_at timestamp without time zone,
  ADD COLUMN IF NOT EXISTS finalized_by integer;

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
  ON public.exams (is_finalized, class_id, section_id, academic_year_id);

COMMIT;

