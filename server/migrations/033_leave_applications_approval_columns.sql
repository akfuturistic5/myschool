-- Ensure leave_applications has columns required by PUT /api/leave-applications/:id (approve/reject).
-- Idempotent: safe on full001_init_full_schema DBs (no-op) and fixes older/partial schemas.

BEGIN;

DO $m$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'leave_applications'
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leave_applications' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE public.leave_applications ADD COLUMN approved_by integer NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leave_applications' AND column_name = 'approved_date'
  ) THEN
    ALTER TABLE public.leave_applications ADD COLUMN approved_date date NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leave_applications' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE public.leave_applications ADD COLUMN rejection_reason text NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leave_applications' AND column_name = 'modified_at'
  ) THEN
    ALTER TABLE public.leave_applications ADD COLUMN modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leave_applications_approved_by_fkey'
  ) THEN
    ALTER TABLE public.leave_applications
      ADD CONSTRAINT leave_applications_approved_by_fkey
      FOREIGN KEY (approved_by) REFERENCES public.staff (id);
  END IF;
END
$m$;

COMMIT;
