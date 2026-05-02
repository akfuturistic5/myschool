-- Migration: Remove academic_year_id from attendance tables
-- Focus: Attendance is date-absolute and does not require a redundant academic year link.

-- 1) Student Attendance
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_academic_year_id_fkey;
ALTER TABLE public.attendance DROP COLUMN IF EXISTS academic_year_id;

-- 2) Staff Attendance
ALTER TABLE public.staff_attendance DROP CONSTRAINT IF EXISTS staff_attendance_academic_year_id_fkey;
ALTER TABLE public.staff_attendance DROP COLUMN IF EXISTS academic_year_id;

-- 3) Cleanup indexes if they exist
DROP INDEX IF EXISTS idx_staff_attendance_year;
DROP INDEX IF EXISTS idx_staff_attendance_year_date;
