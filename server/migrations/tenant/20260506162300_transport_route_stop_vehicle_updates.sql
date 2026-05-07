ALTER TABLE public.pickup_points
  DROP COLUMN IF EXISTS route_id CASCADE,
  DROP COLUMN IF EXISTS pickup_time,
  DROP COLUMN IF EXISTS drop_time;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'routes'
      AND column_name = 'start_point'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'routes'
      AND column_name = 'start_time'
  ) THEN
    EXECUTE 'ALTER TABLE public.routes RENAME COLUMN start_point TO start_time';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'routes'
      AND column_name = 'end_point'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'routes'
      AND column_name = 'end_time'
  ) THEN
    EXECUTE 'ALTER TABLE public.routes RENAME COLUMN end_point TO end_time';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.route_stops (
    id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
    pickup_point_id INTEGER NOT NULL REFERENCES public.pickup_points(id) ON DELETE CASCADE,
    pickup_time TIME,
    drop_time TIME,
    order_index INTEGER DEFAULT 0,
    academic_year_id INTEGER REFERENCES public.academic_years(id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

DROP TABLE IF EXISTS public.student_transport_assignments CASCADE;
