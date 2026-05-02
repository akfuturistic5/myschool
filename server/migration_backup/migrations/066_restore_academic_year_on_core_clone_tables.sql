-- Restore academic_year_id on core clone-scoped academic tables.
-- Requested tables only:
-- classes, sections, subjects, teacher_assignments, class_schedules, teacher_routines
-- Safe to re-run.

-- 1) Add columns if missing
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS academic_year_id INTEGER;

ALTER TABLE public.sections
  ADD COLUMN IF NOT EXISTS academic_year_id INTEGER;

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS academic_year_id INTEGER;

ALTER TABLE public.teacher_assignments
  ADD COLUMN IF NOT EXISTS academic_year_id INTEGER;

ALTER TABLE public.class_schedules
  ADD COLUMN IF NOT EXISTS academic_year_id INTEGER;

ALTER TABLE public.teacher_routines
  ADD COLUMN IF NOT EXISTS academic_year_id INTEGER;

-- 2) Add FK constraints if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classes_academic_year_id_fkey') THEN
    ALTER TABLE public.classes
      ADD CONSTRAINT classes_academic_year_id_fkey
      FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sections_academic_year_id_fkey') THEN
    ALTER TABLE public.sections
      ADD CONSTRAINT sections_academic_year_id_fkey
      FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subjects_academic_year_id_fkey') THEN
    ALTER TABLE public.subjects
      ADD CONSTRAINT subjects_academic_year_id_fkey
      FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teacher_assignments_academic_year_id_fkey') THEN
    ALTER TABLE public.teacher_assignments
      ADD CONSTRAINT teacher_assignments_academic_year_id_fkey
      FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'class_schedules_academic_year_id_fkey') THEN
    ALTER TABLE public.class_schedules
      ADD CONSTRAINT class_schedules_academic_year_id_fkey
      FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teacher_routines_academic_year_id_fkey') THEN
    ALTER TABLE public.teacher_routines
      ADD CONSTRAINT teacher_routines_academic_year_id_fkey
      FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- 3) Backfill from reliable parent relations first
UPDATE public.sections s
SET academic_year_id = c.academic_year_id
FROM public.classes c
WHERE s.class_id = c.id
  AND s.academic_year_id IS NULL
  AND c.academic_year_id IS NOT NULL;

UPDATE public.subjects s
SET academic_year_id = c.academic_year_id
FROM public.classes c
WHERE s.class_id = c.id
  AND s.academic_year_id IS NULL
  AND c.academic_year_id IS NOT NULL;

UPDATE public.teacher_assignments ta
SET academic_year_id = c.academic_year_id
FROM public.classes c
WHERE ta.class_id = c.id
  AND ta.academic_year_id IS NULL
  AND c.academic_year_id IS NOT NULL;

UPDATE public.class_schedules cs
SET academic_year_id = c.academic_year_id
FROM public.classes c
WHERE cs.class_id = c.id
  AND cs.academic_year_id IS NULL
  AND c.academic_year_id IS NOT NULL;

UPDATE public.teacher_routines tr
SET academic_year_id = cs.academic_year_id
FROM public.class_schedules cs
WHERE tr.class_schedule_id = cs.id
  AND tr.academic_year_id IS NULL
  AND cs.academic_year_id IS NOT NULL;

-- 4) Final fallback to current year for remaining NULLs
DO $$
DECLARE
  v_current_year_id INTEGER;
BEGIN
  SELECT id INTO v_current_year_id
  FROM public.academic_years
  WHERE is_current = true
  ORDER BY id DESC
  LIMIT 1;

  IF v_current_year_id IS NOT NULL THEN
    UPDATE public.classes
    SET academic_year_id = v_current_year_id
    WHERE academic_year_id IS NULL;

    UPDATE public.sections
    SET academic_year_id = v_current_year_id
    WHERE academic_year_id IS NULL;

    UPDATE public.subjects
    SET academic_year_id = v_current_year_id
    WHERE academic_year_id IS NULL;

    UPDATE public.teacher_assignments
    SET academic_year_id = v_current_year_id
    WHERE academic_year_id IS NULL;

    UPDATE public.class_schedules
    SET academic_year_id = v_current_year_id
    WHERE academic_year_id IS NULL;

    UPDATE public.teacher_routines
    SET academic_year_id = v_current_year_id
    WHERE academic_year_id IS NULL;
  END IF;
END $$;

-- 5) Indexes for query/filter/clone performance
CREATE INDEX IF NOT EXISTS idx_classes_academic_year_id
  ON public.classes(academic_year_id);

CREATE INDEX IF NOT EXISTS idx_sections_academic_year_id
  ON public.sections(academic_year_id);

CREATE INDEX IF NOT EXISTS idx_subjects_academic_year_id
  ON public.subjects(academic_year_id);

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_academic_year_id
  ON public.teacher_assignments(academic_year_id);

CREATE INDEX IF NOT EXISTS idx_class_schedules_academic_year_id
  ON public.class_schedules(academic_year_id);

CREATE INDEX IF NOT EXISTS idx_teacher_routines_academic_year_id
  ON public.teacher_routines(academic_year_id);

