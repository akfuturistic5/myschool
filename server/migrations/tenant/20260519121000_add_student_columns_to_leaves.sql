BEGIN;

DO $$
BEGIN
  -- Add student_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leave_applications' AND column_name = 'student_id'
  ) THEN
    ALTER TABLE public.leave_applications ADD COLUMN student_id integer NULL REFERENCES public.students(id) ON DELETE CASCADE;
  END IF;

  -- Add staff_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leave_applications' AND column_name = 'staff_id'
  ) THEN
    ALTER TABLE public.leave_applications ADD COLUMN staff_id integer NULL REFERENCES public.staff(id) ON DELETE CASCADE;
  END IF;

  -- Add applicant_type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leave_applications' AND column_name = 'applicant_type'
  ) THEN
    ALTER TABLE public.leave_applications ADD COLUMN applicant_type character varying(20) NULL;
  END IF;

  -- Add start_date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leave_applications' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE public.leave_applications ADD COLUMN start_date date NULL;
  END IF;

  -- Add end_date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leave_applications' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE public.leave_applications ADD COLUMN end_date date NULL;
  END IF;

  -- Add total_days
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leave_applications' AND column_name = 'total_days'
  ) THEN
    ALTER TABLE public.leave_applications ADD COLUMN total_days integer NULL;
  END IF;

  -- Add emergency_contact
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leave_applications' AND column_name = 'emergency_contact'
  ) THEN
    ALTER TABLE public.leave_applications ADD COLUMN emergency_contact character varying(100) NULL;
  END IF;
END $$;

-- Drop check constraint if exists and recreate to allow lowercase
ALTER TABLE public.leave_applications DROP CONSTRAINT IF EXISTS leave_applications_status_check;
ALTER TABLE public.leave_applications ADD CONSTRAINT leave_applications_status_check CHECK (
  LOWER(status) IN ('pending', 'approved', 'rejected', 'cancelled', 'auto-generated', 'accept', 'accepted')
);

-- Make applicant_staff_id and valid_period nullable since standard leaves do not use them
ALTER TABLE public.leave_applications ALTER COLUMN applicant_staff_id DROP NOT NULL;
ALTER TABLE public.leave_applications ALTER COLUMN valid_period DROP NOT NULL;

COMMIT;
