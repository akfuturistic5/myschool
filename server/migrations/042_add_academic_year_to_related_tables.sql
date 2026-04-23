-- Add academic_year_id to all related academic/transport module tables.
-- Safe to re-run (idempotent).

-- 1) Add columns
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS academic_year_id INTEGER;

ALTER TABLE public.teacher_assignments
  ADD COLUMN IF NOT EXISTS academic_year_id INTEGER;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'route_stops'
  ) THEN
    ALTER TABLE public.route_stops
      ADD COLUMN IF NOT EXISTS academic_year_id INTEGER;
  END IF;
END $$;

-- 2) Add FK constraints to academic_years
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subjects_academic_year_id_fkey'
  ) THEN
    ALTER TABLE public.subjects
      ADD CONSTRAINT subjects_academic_year_id_fkey
      FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teacher_assignments_academic_year_id_fkey'
  ) THEN
    ALTER TABLE public.teacher_assignments
      ADD CONSTRAINT teacher_assignments_academic_year_id_fkey
      FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'route_stops'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'route_stops_academic_year_id_fkey'
  ) THEN
    ALTER TABLE public.route_stops
      ADD CONSTRAINT route_stops_academic_year_id_fkey
      FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3) Backfill from parent relations where possible
UPDATE public.subjects s
SET academic_year_id = c.academic_year_id
FROM public.classes c
WHERE s.class_id = c.id
  AND s.academic_year_id IS NULL
  AND c.academic_year_id IS NOT NULL;

UPDATE public.teacher_assignments ta
SET academic_year_id = c.academic_year_id
FROM public.classes c
WHERE ta.class_id = c.id
  AND ta.academic_year_id IS NULL
  AND c.academic_year_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'route_stops'
  ) THEN
    UPDATE public.route_stops rs
    SET academic_year_id = r.academic_year_id
    FROM public.routes r
    WHERE rs.route_id = r.id
      AND rs.academic_year_id IS NULL
      AND r.academic_year_id IS NOT NULL;
  END IF;
END $$;

-- 4) Indexes
CREATE INDEX IF NOT EXISTS idx_subjects_academic_year_id
  ON public.subjects(academic_year_id);

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_academic_year_id
  ON public.teacher_assignments(academic_year_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'route_stops'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_route_stops_academic_year_id
      ON public.route_stops(academic_year_id);
  END IF;
END $$;

