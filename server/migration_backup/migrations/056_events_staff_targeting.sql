BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS target_department_ids jsonb,
  ADD COLUMN IF NOT EXISTS target_designation_ids jsonb;

CREATE INDEX IF NOT EXISTS idx_events_target_department_ids_gin
  ON public.events USING GIN (target_department_ids);

CREATE INDEX IF NOT EXISTS idx_events_target_designation_ids_gin
  ON public.events USING GIN (target_designation_ids);

COMMIT;
