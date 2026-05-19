BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'leave_applications'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'leave_applications' AND column_name = 'document_url'
    ) THEN
      ALTER TABLE public.leave_applications ADD COLUMN document_url text NULL;
    END IF;
  END IF;
END $$;

COMMIT;
