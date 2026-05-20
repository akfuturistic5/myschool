-- Link each transport allocation to the fleet assignment row (vehicle + route + driver context).
ALTER TABLE public.transport_allocations
  ADD COLUMN IF NOT EXISTS vehicle_route_assignment_id integer REFERENCES public.vehicle_route_assignments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transport_alloc_vehicle_route_assignment
  ON public.transport_allocations (vehicle_route_assignment_id)
  WHERE vehicle_route_assignment_id IS NOT NULL AND deleted_at IS NULL;

-- Dev: remove legacy route_id / vehicle_id from transport_allocations (no backfill).
-- Clears existing allocation rows so NOT NULL on vehicle_route_assignment_id can apply cleanly.

DELETE FROM public.transport_allocations;

ALTER TABLE public.transport_allocations
  DROP CONSTRAINT IF EXISTS fk_transport_stop_context;

ALTER TABLE public.transport_allocations
  DROP CONSTRAINT IF EXISTS transport_allocations_route_id_fkey;

ALTER TABLE public.transport_allocations
  DROP CONSTRAINT IF EXISTS transport_allocations_vehicle_id_fkey;

ALTER TABLE public.transport_allocations
  DROP COLUMN IF EXISTS route_id,
  DROP COLUMN IF EXISTS vehicle_id;

ALTER TABLE public.transport_allocations
  ALTER COLUMN vehicle_route_assignment_id SET NOT NULL;

DROP INDEX IF EXISTS idx_transport_alloc_route;
