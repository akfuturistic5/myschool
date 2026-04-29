-- Add separate staff amount for transport fee plans.

ALTER TABLE public.transport_fee_master
  ADD COLUMN IF NOT EXISTS staff_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (staff_amount >= 0);

-- Backfill historical rows: treat existing amount as default for staff as well.
UPDATE public.transport_fee_master
SET staff_amount = amount
WHERE staff_amount = 0;
