-- Timetable integrity: remove duplicate class_schedules rows, then enforce uniqueness at DB level.
-- Safe to re-run: dedupe deletes only duplicate keys (keeps lowest id). Indexes use IF NOT EXISTS.

-- 1) Teacher / slot duplicates (same year + teacher + day + period)
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY academic_year_id, teacher_id, day_of_week, time_slot_id
      ORDER BY id ASC
    ) AS rn
  FROM public.class_schedules
  WHERE teacher_id IS NOT NULL
)
DELETE FROM public.teacher_routines tr
USING ranked r
WHERE tr.class_schedule_id = r.id AND r.rn > 1;

WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY academic_year_id, teacher_id, day_of_week, time_slot_id
      ORDER BY id ASC
    ) AS rn
  FROM public.class_schedules
  WHERE teacher_id IS NOT NULL
)
DELETE FROM public.class_schedules cs
USING ranked r
WHERE cs.id = r.id AND r.rn > 1;

-- 2) Class / section / slot duplicates (same year + class + section + day + period)
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY academic_year_id, class_id, section_id, day_of_week, time_slot_id
      ORDER BY id ASC
    ) AS rn
  FROM public.class_schedules
)
DELETE FROM public.teacher_routines tr
USING ranked r
WHERE tr.class_schedule_id = r.id AND r.rn > 1;

WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY academic_year_id, class_id, section_id, day_of_week, time_slot_id
      ORDER BY id ASC
    ) AS rn
  FROM public.class_schedules
)
DELETE FROM public.class_schedules cs
USING ranked r
WHERE cs.id = r.id AND r.rn > 1;

-- 3) Unique indexes (expression normalizes NULL section to sentinel -1; real section ids are positive)
DROP INDEX IF EXISTS public.uq_class_schedules_teacher_year_day_slot;
CREATE UNIQUE INDEX uq_class_schedules_teacher_year_day_slot
  ON public.class_schedules (academic_year_id, teacher_id, day_of_week, time_slot_id)
  WHERE teacher_id IS NOT NULL;

DROP INDEX IF EXISTS public.uq_class_schedules_class_year_day_slot;
CREATE UNIQUE INDEX uq_class_schedules_class_year_day_slot
  ON public.class_schedules (
    academic_year_id,
    class_id,
    (COALESCE(section_id, -1)),
    day_of_week,
    time_slot_id
  );
