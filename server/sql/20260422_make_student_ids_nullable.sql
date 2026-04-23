-- Migration: Make student ID columns nullable
-- Date: 2026-04-22

ALTER TABLE students ALTER COLUMN unique_student_ids DROP NOT NULL;
ALTER TABLE students ALTER COLUMN pen_number DROP NOT NULL;
ALTER TABLE students ALTER COLUMN aadhar_no DROP NOT NULL;

-- Ensure unique constraints still exist but allow multiple NULLs (Postgres default behavior for UNIQUE)
-- unique_student_ids_unique
-- pen_number_unique
-- aadhar_unique
