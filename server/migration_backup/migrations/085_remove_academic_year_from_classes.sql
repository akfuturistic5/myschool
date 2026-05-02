-- Migration: Remove academic_year_id from classes table
-- Focus: Converting classes to a global entity catalog

-- 1) Drop foreign key constraint first
ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_academic_year_id_fkey;

-- 2) Drop the column
ALTER TABLE public.classes DROP COLUMN IF EXISTS academic_year_id;
