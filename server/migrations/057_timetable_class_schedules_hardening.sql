-- Timetable (class_schedules) hardening: optional class_room FK, query indexes, teacher_routines alignment support.
-- Safe to re-run (IF NOT EXISTS).

-- Link timetable rows to class_rooms when the column is missing (older DBs).
ALTER TABLE public.class_schedules
  ADD COLUMN IF NOT EXISTS class_room_id integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'class_schedules' AND c.conname = 'class_schedules_class_room_id_fkey'
  ) THEN
    ALTER TABLE public.class_schedules
      ADD CONSTRAINT class_schedules_class_room_id_fkey
      FOREIGN KEY (class_room_id) REFERENCES public.class_rooms(id) ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
  WHEN invalid_foreign_key THEN
    NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_class_schedules_year_class_section_day_slot
  ON public.class_schedules (academic_year_id, class_id, section_id, day_of_week, time_slot_id);

CREATE INDEX IF NOT EXISTS idx_class_schedules_year_teacher_day_slot
  ON public.class_schedules (academic_year_id, teacher_id, day_of_week, time_slot_id);

CREATE INDEX IF NOT EXISTS idx_class_schedules_academic_year_id
  ON public.class_schedules (academic_year_id);
