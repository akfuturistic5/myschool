-- Migration: Allow NULL class_section_id in class_schedules
-- Purpose: Support section-less classes in timetable

ALTER TABLE public.class_schedules ALTER COLUMN class_section_id DROP NOT NULL;
