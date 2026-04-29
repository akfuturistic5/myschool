ALTER TABLE public.transport_fee_master
  ADD COLUMN IF NOT EXISTS academic_year_id INTEGER NULL REFERENCES public.academic_years(id) ON DELETE SET NULL;

ALTER TABLE public.transport_allocations
  ADD COLUMN IF NOT EXISTS academic_year_id INTEGER NULL REFERENCES public.academic_years(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transport_fee_master_academic_year_id
  ON public.transport_fee_master (academic_year_id);

CREATE INDEX IF NOT EXISTS idx_transport_allocations_academic_year_id
  ON public.transport_allocations (academic_year_id);

UPDATE public.transport_fee_master
SET academic_year_id = (
  SELECT id FROM public.academic_years WHERE is_current = true ORDER BY id DESC LIMIT 1
)
WHERE academic_year_id IS NULL;

UPDATE public.transport_allocations
SET academic_year_id = (
  SELECT id FROM public.academic_years WHERE is_current = true ORDER BY id DESC LIMIT 1
)
WHERE academic_year_id IS NULL;
