-- Migration to drop the redundant is_active column from the students table
ALTER TABLE public.students DROP COLUMN IF EXISTS is_active;
