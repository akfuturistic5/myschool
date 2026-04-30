-- Add missing transport tables and columns
BEGIN;

-- 1. Add deleted_at to transport tables
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
ALTER TABLE public.pickup_points ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- 2. Add updated_at if missing (aliased to modified_at or created_at)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='routes' AND column_name='updated_at') THEN
        ALTER TABLE public.routes ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='updated_at') THEN
        ALTER TABLE public.vehicles ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pickup_points' AND column_name='updated_at') THEN
        ALTER TABLE public.pickup_points ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='updated_at') THEN
        ALTER TABLE public.drivers ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- 3. Create route_stops table if missing
CREATE TABLE IF NOT EXISTS public.route_stops (
    id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
    pickup_point_id INTEGER NOT NULL REFERENCES public.pickup_points(id) ON DELETE CASCADE,
    pickup_time TIME,
    drop_time TIME,
    order_index INTEGER DEFAULT 0,
    academic_year_id INTEGER REFERENCES public.academic_years(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

-- 4. Indexes for performance and consistency
CREATE INDEX IF NOT EXISTS idx_routes_deleted_at ON public.routes (deleted_at);
CREATE INDEX IF NOT EXISTS idx_vehicles_deleted_at ON public.vehicles (deleted_at);
CREATE INDEX IF NOT EXISTS idx_pickup_points_deleted_at ON public.pickup_points (deleted_at);
CREATE INDEX IF NOT EXISTS idx_drivers_deleted_at ON public.drivers (deleted_at);
CREATE INDEX IF NOT EXISTS idx_route_stops_route_id ON public.route_stops (route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_pickup_point_id ON public.route_stops (pickup_point_id);

COMMIT;
