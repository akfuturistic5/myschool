-- Allow academic years to be created without a fixed end date; end date is set when the year is closed.
-- Safe for existing rows: they already have end_date populated.

ALTER TABLE public.academic_years
  ALTER COLUMN end_date DROP NOT NULL;
