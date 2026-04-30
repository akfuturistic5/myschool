-- Fill duration (minutes) for existing rows where it was never set. Safe to re-run.
UPDATE public.time_slots
SET duration = GREATEST(1, (EXTRACT(EPOCH FROM (end_time - start_time)) / 60)::int)
WHERE duration IS NULL
  AND start_time IS NOT NULL
  AND end_time IS NOT NULL
  AND end_time > start_time;
