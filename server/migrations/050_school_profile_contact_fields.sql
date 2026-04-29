-- Add missing school profile contact fields for School Level Settings.
ALTER TABLE IF EXISTS public.school_profile
  ADD COLUMN IF NOT EXISTS phone VARCHAR(30) NULL,
  ADD COLUMN IF NOT EXISTS email VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS fax VARCHAR(30) NULL,
  ADD COLUMN IF NOT EXISTS address TEXT NULL;

