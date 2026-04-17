-- Migration: Transport Trigger Cleanup (Final Stabilization)
-- Created: 2026-04-14
-- Description: Drops legacy triggers that reference 'modified_at' to fix the "record new has no field modified at" error.

DO $$ 
BEGIN
    -- 1. DROP ALL KNOWN LEGACY TRIGGER NAMES
    -- Drivers
    DROP TRIGGER IF EXISTS trg_update_drivers_modified_at ON public.drivers;
    DROP TRIGGER IF EXISTS trg_drivers_modified_at ON public.drivers;
    DROP TRIGGER IF EXISTS update_drivers_modified_at ON public.drivers;

    -- Vehicles
    DROP TRIGGER IF EXISTS trg_update_vehicles_modified_at ON public.vehicles;
    DROP TRIGGER IF EXISTS trg_vehicles_modified_at ON public.vehicles;
    DROP TRIGGER IF EXISTS update_vehicles_modified_at ON public.vehicles;

    -- Routes
    DROP TRIGGER IF EXISTS trg_update_routes_modified_at ON public.routes;
    DROP TRIGGER IF EXISTS trg_routes_modified_at ON public.routes;
    DROP TRIGGER IF EXISTS update_routes_modified_at ON public.routes;

    -- Pickup Points
    DROP TRIGGER IF EXISTS trg_update_pickup_points_modified_at ON public.pickup_points;
    DROP TRIGGER IF EXISTS trg_pickup_points_modified_at ON public.pickup_points;
    DROP TRIGGER IF EXISTS update_pickup_points_modified_at ON public.pickup_points;

    -- 2. ENSURE THE MODERN TRIGGER EXISTS (RE-ATTACH JUST IN CASE)
    -- Drivers
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='updated_at') THEN
        DROP TRIGGER IF EXISTS trg_drivers_updated_at ON public.drivers;
        CREATE TRIGGER trg_drivers_updated_at
            BEFORE UPDATE ON public.drivers
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;

    -- Vehicles
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='updated_at') THEN
        DROP TRIGGER IF EXISTS trg_vehicles_updated_at ON public.vehicles;
        CREATE TRIGGER trg_vehicles_updated_at
            BEFORE UPDATE ON public.vehicles
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;

    -- Routes
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='routes' AND column_name='updated_at') THEN
        DROP TRIGGER IF EXISTS trg_routes_updated_at ON public.routes;
        CREATE TRIGGER trg_routes_updated_at
            BEFORE UPDATE ON public.routes
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;

    -- Pickup Points
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pickup_points' AND column_name='updated_at') THEN
        DROP TRIGGER IF EXISTS trg_pickup_points_updated_at ON public.pickup_points;
        CREATE TRIGGER trg_pickup_points_updated_at
            BEFORE UPDATE ON public.pickup_points
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;

END $$;
