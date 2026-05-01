-- Drop academic year scope from transport + hostel entities.
-- Safe to run multiple times across environments.

DO $$
DECLARE
  rec RECORD;
BEGIN
  -- Drop any FK/constraints bound to academic_year_id on target tables.
  FOR rec IN
    SELECT c.conname, cls.relname AS table_name
    FROM pg_constraint c
    JOIN pg_class cls ON cls.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = cls.relnamespace
    JOIN unnest(c.conkey) AS ck(attnum) ON true
    JOIN pg_attribute a ON a.attrelid = cls.oid AND a.attnum = ck.attnum
    WHERE ns.nspname = 'public'
      AND cls.relname IN (
        'routes',
        'pickup_points',
        'drivers',
        'vehicles',
        'transport_assignments',
        'hostels',
        'hostel_rooms',
        'room_types'
      )
      AND a.attname = 'academic_year_id'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      rec.table_name,
      rec.conname
    );
  END LOOP;

  -- Drop indexes that include academic_year_id on target tables.
  FOR rec IN
    SELECT schemaname, tablename, indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename IN (
        'routes',
        'pickup_points',
        'drivers',
        'vehicles',
        'transport_assignments',
        'hostels',
        'hostel_rooms',
        'room_types'
      )
      AND indexdef ILIKE '%academic_year_id%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I.%I', rec.schemaname, rec.indexname);
  END LOOP;
END $$;

ALTER TABLE public.routes DROP COLUMN IF EXISTS academic_year_id;
ALTER TABLE public.pickup_points DROP COLUMN IF EXISTS academic_year_id;
ALTER TABLE public.drivers DROP COLUMN IF EXISTS academic_year_id;
ALTER TABLE public.vehicles DROP COLUMN IF EXISTS academic_year_id;
ALTER TABLE public.transport_assignments DROP COLUMN IF EXISTS academic_year_id;
ALTER TABLE public.hostels DROP COLUMN IF EXISTS academic_year_id;
ALTER TABLE public.hostel_rooms DROP COLUMN IF EXISTS academic_year_id;
ALTER TABLE public.room_types DROP COLUMN IF EXISTS academic_year_id;
