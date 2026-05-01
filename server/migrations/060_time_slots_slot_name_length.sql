-- Align time_slots.slot_name with API / UI (Joi + form maxLength 100). Safe to re-run.
ALTER TABLE public.time_slots
  ALTER COLUMN slot_name TYPE VARCHAR(100);
