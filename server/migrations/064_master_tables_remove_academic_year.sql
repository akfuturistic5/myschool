-- Convert selected tables to master/global behavior (no academic_year_id).
-- Tables: departments, designations, drivers, routes, pickup_points
-- Safe to re-run.

-- 1) Drop indexes referencing academic_year_id (if present)
DROP INDEX IF EXISTS idx_departments_academic_year_id;
DROP INDEX IF EXISTS idx_designations_academic_year_id;
DROP INDEX IF EXISTS idx_drivers_academic_year_id;
DROP INDEX IF EXISTS idx_routes_academic_year_id;
DROP INDEX IF EXISTS idx_pickup_points_academic_year_id;

-- 2) Drop FK constraints referencing academic_years (if present)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_academic_year_id_fkey') THEN
    ALTER TABLE public.departments DROP CONSTRAINT departments_academic_year_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'designations_academic_year_id_fkey') THEN
    ALTER TABLE public.designations DROP CONSTRAINT designations_academic_year_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_drivers_academic_year') THEN
    ALTER TABLE public.drivers DROP CONSTRAINT fk_drivers_academic_year;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_routes_academic_year') THEN
    ALTER TABLE public.routes DROP CONSTRAINT fk_routes_academic_year;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pickup_points_academic_year') THEN
    ALTER TABLE public.pickup_points DROP CONSTRAINT fk_pickup_points_academic_year;
  END IF;
END $$;

-- 3) Drop academic_year_id columns from requested master tables
ALTER TABLE public.departments DROP COLUMN IF EXISTS academic_year_id;
ALTER TABLE public.designations DROP COLUMN IF EXISTS academic_year_id;
ALTER TABLE public.drivers DROP COLUMN IF EXISTS academic_year_id;
ALTER TABLE public.routes DROP COLUMN IF EXISTS academic_year_id;
ALTER TABLE public.pickup_points DROP COLUMN IF EXISTS academic_year_id;

