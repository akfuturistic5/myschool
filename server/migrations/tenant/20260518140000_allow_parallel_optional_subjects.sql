-- Migration: Allow parallel optional/elective subjects in the same period for a class/section
-- Drops old single-subject-per-slot constraint and replaces it with subject-specific slot constraint.

ALTER TABLE public.class_schedules 
DROP CONSTRAINT IF EXISTS uq_timetable_section_no_overlap;

ALTER TABLE public.class_schedules 
ADD CONSTRAINT uq_timetable_section_no_overlap 
EXCLUDE USING gist (
    class_section_id WITH =,
    class_subject_id WITH =,
    day_of_week WITH =,
    time_slot_id WITH =,
    daterange(valid_from, COALESCE(valid_to, 'infinity'::date)) WITH &&
);
