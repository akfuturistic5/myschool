-- Hostel module: academic year scope + intake/description columns for UI parity
-- Safe to run multiple times (IF NOT EXISTS)

ALTER TABLE public.hostels
  ADD COLUMN IF NOT EXISTS academic_year_id INTEGER REFERENCES public.academic_years (id) ON DELETE SET NULL;

ALTER TABLE public.hostels
  ADD COLUMN IF NOT EXISTS intake_capacity INTEGER;

ALTER TABLE public.hostels
  ADD COLUMN IF NOT EXISTS description TEXT;

CREATE INDEX IF NOT EXISTS idx_hostels_academic_year_id ON public.hostels (academic_year_id);

-- Backfill academic year: prefer is_current, else latest active year by start_date
UPDATE public.hostels h
SET academic_year_id = ay.id
FROM (
  SELECT id FROM public.academic_years
  WHERE COALESCE(is_active, true) = true AND is_current IS TRUE
  ORDER BY id LIMIT 1
) ay
WHERE h.academic_year_id IS NULL;

UPDATE public.hostels h
SET academic_year_id = ay.id
FROM (
  SELECT id FROM public.academic_years
  WHERE COALESCE(is_active, true) = true
  ORDER BY start_date DESC NULLS LAST, id DESC
  LIMIT 1
) ay
WHERE h.academic_year_id IS NULL;

-- Reasonable default for intake when absent (UI field)
UPDATE public.hostels
SET intake_capacity = COALESCE(intake_capacity, NULLIF(total_rooms, 0) * 4)
WHERE intake_capacity IS NULL;
