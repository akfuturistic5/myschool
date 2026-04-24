-- Consolidated Transport Migration Part 2
-- Covers legacy 024-025 for driver roles and assignment normalization.

-- Driver role + user linkage
ALTER TABLE public.drivers
    ADD COLUMN IF NOT EXISTS role character varying(20) NOT NULL DEFAULT 'driver',
    ADD COLUMN IF NOT EXISTS user_id integer;

ALTER TABLE public.drivers
    ALTER COLUMN license_number DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'drivers'
          AND constraint_name = 'drivers_role_check'
    ) THEN
        ALTER TABLE public.drivers
            ADD CONSTRAINT drivers_role_check CHECK (role IN ('driver', 'conductor'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'drivers'
          AND constraint_name = 'drivers_user_id_fkey'
    ) THEN
        ALTER TABLE public.drivers
            ADD CONSTRAINT drivers_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_drivers_role ON public.drivers(role);
CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON public.drivers(user_id);

-- Seed user roles for transport staff
INSERT INTO public.user_roles (role_name, description, is_active, created_at, modified_at)
SELECT 'driver', 'Transport Driver with limited access', true, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE LOWER(role_name) = 'driver'
);

INSERT INTO public.user_roles (role_name, description, is_active, created_at, modified_at)
SELECT 'conductor', 'Transport Conductor with limited access', true, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE LOWER(role_name) = 'conductor'
);

-- Multi-assignment table (vehicle can be mapped to many route-driver pairs)
CREATE TABLE IF NOT EXISTS public.transport_assignments (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    route_id INTEGER NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
    driver_id INTEGER NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_transport_assignments_active_triplet
    ON public.transport_assignments(vehicle_id, route_id, driver_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_transport_assignments_vehicle_id
    ON public.transport_assignments(vehicle_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_transport_assignments_route_id
    ON public.transport_assignments(route_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_transport_assignments_driver_id
    ON public.transport_assignments(driver_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_transport_assignments_is_active
    ON public.transport_assignments(is_active)
    WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_transport_assignments_updated_at ON public.transport_assignments;
CREATE TRIGGER trg_transport_assignments_updated_at
    BEFORE UPDATE ON public.transport_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- One-time backfill from old single-assignment model on vehicles
INSERT INTO public.transport_assignments (vehicle_id, route_id, driver_id, is_active, created_at, updated_at)
SELECT
    v.id,
    v.route_id,
    v.driver_id,
    COALESCE(v.is_active, true),
    NOW(),
    NOW()
FROM public.vehicles v
WHERE 1=1
  AND v.route_id IS NOT NULL
  AND v.driver_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM public.transport_assignments ta
      WHERE 1=1
        AND ta.vehicle_id = v.id
        AND ta.route_id = v.route_id
        AND ta.driver_id = v.driver_id
  );
