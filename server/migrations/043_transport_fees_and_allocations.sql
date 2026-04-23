-- Transport fees and allocations module

CREATE TABLE IF NOT EXISTS public.transport_fee_master (
    id SERIAL PRIMARY KEY,
    pickup_point_id INTEGER NOT NULL REFERENCES public.pickup_points(id) ON DELETE CASCADE,
    plan_name TEXT NOT NULL,
    duration_days INTEGER NULL CHECK (duration_days IS NULL OR duration_days > 0),
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_transport_fee_master_plan_per_pickup
    ON public.transport_fee_master (pickup_point_id, lower(plan_name), COALESCE(duration_days, -1));

CREATE INDEX IF NOT EXISTS idx_transport_fee_master_pickup
    ON public.transport_fee_master (pickup_point_id);

CREATE INDEX IF NOT EXISTS idx_transport_fee_master_status
    ON public.transport_fee_master (status);

DROP TRIGGER IF EXISTS trg_transport_fee_master_updated_at ON public.transport_fee_master;
CREATE TRIGGER trg_transport_fee_master_updated_at
    BEFORE UPDATE ON public.transport_fee_master
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.transport_allocations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('student', 'staff')),
    route_id INTEGER NOT NULL REFERENCES public.routes(id) ON DELETE RESTRICT,
    pickup_point_id INTEGER NOT NULL REFERENCES public.pickup_points(id) ON DELETE RESTRICT,
    vehicle_id INTEGER NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
    assigned_fee_id INTEGER NULL REFERENCES public.transport_fee_master(id) ON DELETE SET NULL,
    assigned_fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (assigned_fee_amount >= 0),
    is_free BOOLEAN NOT NULL DEFAULT false,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_transport_allocations_vehicle
    ON public.transport_allocations (vehicle_id);

CREATE INDEX IF NOT EXISTS idx_transport_allocations_user
    ON public.transport_allocations (user_type, user_id);

CREATE INDEX IF NOT EXISTS idx_transport_allocations_active_vehicle
    ON public.transport_allocations (vehicle_id, status, start_date, end_date);

CREATE UNIQUE INDEX IF NOT EXISTS uq_transport_allocations_active_user
    ON public.transport_allocations (user_type, user_id)
    WHERE end_date IS NULL AND status = 'Active';

DROP TRIGGER IF EXISTS trg_transport_allocations_updated_at ON public.transport_allocations;
CREATE TRIGGER trg_transport_allocations_updated_at
    BEFORE UPDATE ON public.transport_allocations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
