-- Rename route start/end times to pickup start/end; add drop start/end times.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'routes' AND column_name = 'start_time'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'routes' AND column_name = 'pickup_start_time'
  ) THEN
    EXECUTE 'ALTER TABLE public.routes RENAME COLUMN start_time TO pickup_start_time';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'routes' AND column_name = 'end_time'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'routes' AND column_name = 'pickup_end_time'
  ) THEN
    EXECUTE 'ALTER TABLE public.routes RENAME COLUMN end_time TO pickup_end_time';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'routes' AND column_name = 'start_point'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'routes' AND column_name = 'pickup_start_time'
  ) THEN
    EXECUTE 'ALTER TABLE public.routes RENAME COLUMN start_point TO pickup_start_time';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'routes' AND column_name = 'end_point'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'routes' AND column_name = 'pickup_end_time'
  ) THEN
    EXECUTE 'ALTER TABLE public.routes RENAME COLUMN end_point TO pickup_end_time';
  END IF;
END $$;

ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS drop_start_time TIME,
  ADD COLUMN IF NOT EXISTS drop_end_time TIME;
