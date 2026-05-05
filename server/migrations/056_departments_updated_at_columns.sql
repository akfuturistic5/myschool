-- Align departments with canonical audit columns used by the API (updated_at, updated_by).
-- Safe for fresh tenant schema (columns already exist) and legacy DBs that used modified_at only.

ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS updated_by INTEGER;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'departments' AND column_name = 'modified_at'
  ) THEN
    UPDATE public.departments SET updated_at = modified_at::timestamptz WHERE updated_at IS NULL;
  END IF;
END $$;

UPDATE public.departments
SET updated_at = COALESCE(updated_at, created_at::timestamptz, NOW())
WHERE updated_at IS NULL;

ALTER TABLE public.departments ALTER COLUMN updated_at SET DEFAULT NOW();
