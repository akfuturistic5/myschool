-- Consolidated Transport Migration Part 3
-- Covers legacy 026 for academic-year scoping in transport entities.

ALTER TABLE public.routes
    ADD COLUMN IF NOT EXISTS academic_year_id INTEGER;
ALTER TABLE public.pickup_points
    ADD COLUMN IF NOT EXISTS academic_year_id INTEGER;
ALTER TABLE public.drivers
    ADD COLUMN IF NOT EXISTS academic_year_id INTEGER;
ALTER TABLE public.vehicles
    ADD COLUMN IF NOT EXISTS academic_year_id INTEGER;
ALTER TABLE public.transport_assignments
    ADD COLUMN IF NOT EXISTS academic_year_id INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_routes_academic_year') THEN
        ALTER TABLE public.routes
            ADD CONSTRAINT fk_routes_academic_year
            FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pickup_points_academic_year') THEN
        ALTER TABLE public.pickup_points
            ADD CONSTRAINT fk_pickup_points_academic_year
            FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_drivers_academic_year') THEN
        ALTER TABLE public.drivers
            ADD CONSTRAINT fk_drivers_academic_year
            FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_vehicles_academic_year') THEN
        ALTER TABLE public.vehicles
            ADD CONSTRAINT fk_vehicles_academic_year
            FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transport_assignments_academic_year') THEN
        ALTER TABLE public.transport_assignments
            ADD CONSTRAINT fk_transport_assignments_academic_year
            FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_routes_academic_year_id ON public.routes(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_pickup_points_academic_year_id ON public.pickup_points(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_drivers_academic_year_id ON public.drivers(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_academic_year_id ON public.vehicles(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_transport_assignments_academic_year_id ON public.transport_assignments(academic_year_id);

-- Backfill to current year where missing
DO $$
DECLARE
    v_current_academic_year_id INTEGER;
BEGIN
    SELECT id INTO v_current_academic_year_id
    FROM public.academic_years
    WHERE is_current = true AND is_active = true
    ORDER BY id DESC
    LIMIT 1;

    IF v_current_academic_year_id IS NOT NULL THEN
        UPDATE public.routes SET academic_year_id = v_current_academic_year_id WHERE academic_year_id IS NULL;
        UPDATE public.pickup_points SET academic_year_id = v_current_academic_year_id WHERE academic_year_id IS NULL;
        UPDATE public.drivers SET academic_year_id = v_current_academic_year_id WHERE academic_year_id IS NULL;
        UPDATE public.vehicles SET academic_year_id = v_current_academic_year_id WHERE academic_year_id IS NULL;
        UPDATE public.transport_assignments SET academic_year_id = v_current_academic_year_id WHERE academic_year_id IS NULL;
    END IF;
END $$;
