-- Align transport_allocations.user_id with polymorphic student/staff PKs (matches application code).
ALTER TABLE public.transport_allocations
  DROP CONSTRAINT IF EXISTS transport_allocations_user_id_fkey;

-- Staff/hostel + transport flags (mirror students table capabilities for teacher forms).
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS is_transport_required boolean NOT NULL DEFAULT false;

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS is_hostel_required boolean NOT NULL DEFAULT false;
