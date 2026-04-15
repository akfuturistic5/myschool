-- Consolidated Transport Migration Part 1
-- Covers legacy 015-023 for routes/pickup/drivers/vehicles/route_stops standardization.

-- Ensure core columns exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='routes' AND column_name='distance_km') THEN
        ALTER TABLE public.routes ADD COLUMN distance_km NUMERIC(10, 2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='routes' AND column_name='deleted_at') THEN
        ALTER TABLE public.routes ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pickup_points' AND column_name='deleted_at') THEN
        ALTER TABLE public.pickup_points ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='deleted_at') THEN
        ALTER TABLE public.drivers ADD COLUMN deleted_at TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='deleted_at') THEN
        ALTER TABLE public.vehicles ADD COLUMN deleted_at TIMESTAMP;
    END IF;
END $$;

-- Backfill distance from legacy column if present
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='routes' AND column_name='total_distance') THEN
        UPDATE public.routes
        SET distance_km = total_distance
        WHERE distance_km IS NULL AND total_distance IS NOT NULL;
    END IF;
END $$;

-- Multi-stop route model
CREATE TABLE IF NOT EXISTS public.route_stops (
    id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL,
    pickup_point_id INTEGER NOT NULL,
    pickup_time TIME,
    drop_time TIME,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_route_stops_route FOREIGN KEY (route_id) REFERENCES public.routes(id) ON DELETE CASCADE,
    CONSTRAINT fk_route_stops_point FOREIGN KEY (pickup_point_id) REFERENCES public.pickup_points(id) ON DELETE CASCADE
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='route_stops' AND column_name='modified_at')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='route_stops' AND column_name='updated_at') THEN
        ALTER TABLE public.route_stops RENAME COLUMN modified_at TO updated_at;
    END IF;
END $$;

-- Migrate legacy single-stop data (if legacy route columns still exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='routes' AND column_name='pickup_point_id') THEN
        INSERT INTO public.route_stops (route_id, pickup_point_id, pickup_time, drop_time, order_index)
        SELECT id, pickup_point_id, pickup_time, drop_time, 0
        FROM public.routes r
        WHERE r.pickup_point_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.route_stops rs
              WHERE rs.route_id = r.id AND rs.pickup_point_id = r.pickup_point_id
          );
    END IF;
END $$;

-- Remove obsolete columns from prior transport model
ALTER TABLE public.routes
    DROP COLUMN IF EXISTS pickup_point_id CASCADE,
    DROP COLUMN IF EXISTS pickup_time CASCADE,
    DROP COLUMN IF EXISTS drop_time CASCADE,
    DROP COLUMN IF EXISTS route_code CASCADE,
    DROP COLUMN IF EXISTS start_point CASCADE,
    DROP COLUMN IF EXISTS end_point CASCADE,
    DROP COLUMN IF EXISTS total_distance CASCADE,
    DROP COLUMN IF EXISTS estimated_time CASCADE,
    DROP COLUMN IF EXISTS route_fee CASCADE,
    DROP COLUMN IF EXISTS description CASCADE;

ALTER TABLE public.pickup_points
    DROP COLUMN IF EXISTS route_id CASCADE,
    DROP COLUMN IF EXISTS pickup_time CASCADE,
    DROP COLUMN IF EXISTS drop_time CASCADE,
    DROP COLUMN IF EXISTS address CASCADE,
    DROP COLUMN IF EXISTS landmark CASCADE,
    DROP COLUMN IF EXISTS distance_from_school CASCADE,
    DROP COLUMN IF EXISTS sequence_order CASCADE;

ALTER TABLE public.drivers
    DROP COLUMN IF EXISTS employee_code CASCADE,
    DROP COLUMN IF EXISTS email CASCADE,
    DROP COLUMN IF EXISTS license_expiry CASCADE,
    DROP COLUMN IF EXISTS emergency_contact CASCADE,
    DROP COLUMN IF EXISTS joining_date CASCADE,
    DROP COLUMN IF EXISTS salary CASCADE;

ALTER TABLE public.vehicles
    DROP COLUMN IF EXISTS pickup_point_id CASCADE,
    DROP COLUMN IF EXISTS vehicle_type CASCADE,
    DROP COLUMN IF EXISTS brand CASCADE,
    DROP COLUMN IF EXISTS insurance_expiry CASCADE,
    DROP COLUMN IF EXISTS fitness_certificate_expiry CASCADE,
    DROP COLUMN IF EXISTS permit_expiry CASCADE,
    DROP COLUMN IF EXISTS fuel_type CASCADE;

-- Timestamp column normalization
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='routes' AND column_name='modified_at') THEN
        ALTER TABLE public.routes RENAME COLUMN modified_at TO updated_at;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pickup_points' AND column_name='modified_at') THEN
        ALTER TABLE public.pickup_points RENAME COLUMN modified_at TO updated_at;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='modified_at') THEN
        ALTER TABLE public.drivers RENAME COLUMN modified_at TO updated_at;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='modified_at') THEN
        ALTER TABLE public.vehicles RENAME COLUMN modified_at TO updated_at;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='routes' AND column_name='updated_at') THEN
        ALTER TABLE public.routes ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pickup_points' AND column_name='updated_at') THEN
        ALTER TABLE public.pickup_points ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='updated_at') THEN
        ALTER TABLE public.drivers ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='updated_at') THEN
        ALTER TABLE public.vehicles ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Shared trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $func$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- Attach/refresh updated_at triggers
DROP TRIGGER IF EXISTS trg_routes_updated_at ON public.routes;
DROP TRIGGER IF EXISTS trg_routes_modified_at ON public.routes;
CREATE TRIGGER trg_routes_updated_at
    BEFORE UPDATE ON public.routes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_pickup_points_updated_at ON public.pickup_points;
DROP TRIGGER IF EXISTS trg_pickup_points_modified_at ON public.pickup_points;
CREATE TRIGGER trg_pickup_points_updated_at
    BEFORE UPDATE ON public.pickup_points
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_drivers_updated_at ON public.drivers;
DROP TRIGGER IF EXISTS trg_drivers_modified_at ON public.drivers;
DROP TRIGGER IF EXISTS trg_update_drivers_modified_at ON public.drivers;
CREATE TRIGGER trg_drivers_updated_at
    BEFORE UPDATE ON public.drivers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_vehicles_updated_at ON public.vehicles;
DROP TRIGGER IF EXISTS trg_vehicles_modified_at ON public.vehicles;
DROP TRIGGER IF EXISTS trg_update_vehicles_modified_at ON public.vehicles;
CREATE TRIGGER trg_vehicles_updated_at
    BEFORE UPDATE ON public.vehicles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_route_stops_updated_at ON public.route_stops;
DROP TRIGGER IF EXISTS trg_route_stops_modified_at ON public.route_stops;
CREATE TRIGGER trg_route_stops_updated_at
    BEFORE UPDATE ON public.route_stops
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_routes_route_name ON public.routes(route_name);
CREATE INDEX IF NOT EXISTS idx_routes_is_active ON public.routes(is_active);
CREATE INDEX IF NOT EXISTS idx_routes_deleted_at ON public.routes(deleted_at);
CREATE INDEX IF NOT EXISTS idx_route_stops_route_id ON public.route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_pickup_point_id ON public.route_stops(pickup_point_id);

CREATE INDEX IF NOT EXISTS idx_pickup_points_is_active ON public.pickup_points(is_active);
CREATE INDEX IF NOT EXISTS idx_pickup_points_deleted_at ON public.pickup_points(deleted_at);

CREATE INDEX IF NOT EXISTS idx_drivers_name ON public.drivers(driver_name);
CREATE INDEX IF NOT EXISTS idx_drivers_is_active ON public.drivers(is_active);
CREATE INDEX IF NOT EXISTS idx_drivers_deleted_at ON public.drivers(deleted_at);

CREATE INDEX IF NOT EXISTS idx_vehicles_number ON public.vehicles(vehicle_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_is_active ON public.vehicles(is_active);
CREATE INDEX IF NOT EXISTS idx_vehicles_deleted_at ON public.vehicles(deleted_at);
CREATE INDEX IF NOT EXISTS idx_vehicles_route_id ON public.vehicles(route_id);
