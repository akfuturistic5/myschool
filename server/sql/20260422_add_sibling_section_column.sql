-- Migration: Add section_name to student_siblings
-- Date: 2026-04-22

ALTER TABLE student_siblings ADD COLUMN section_name TEXT;
