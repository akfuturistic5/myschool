-- One teacher per (class, section, subject) slot. Previous indexes only enforced uniqueness
-- per teacher, so two different teachers could claim the same class/section/subject.
--
-- Apply on tenant DB, e.g.:
--   npm run db:migrate:teacher-assignments-unique
--   psql "$DATABASE_URL" -f server/migrations/022_teacher_assignments_unique_slot.sql

-- Keep the oldest row per slot; remove newer duplicates (deterministic, id ASC wins).
DELETE FROM public.teacher_assignments ta
WHERE EXISTS (
  SELECT 1
  FROM public.teacher_assignments tb
  WHERE tb.class_id = ta.class_id
    AND tb.subject_id = ta.subject_id
    AND tb.section_id IS NOT DISTINCT FROM ta.section_id
    AND tb.id < ta.id
);

DROP INDEX IF EXISTS public.uq_teacher_assignments_with_section;
DROP INDEX IF EXISTS public.uq_teacher_assignments_no_section;

-- Section-based classes: at most one assignment per (class, section, subject).
CREATE UNIQUE INDEX IF NOT EXISTS uq_teacher_assignments_class_section_subject
  ON public.teacher_assignments (class_id, section_id, subject_id)
  WHERE section_id IS NOT NULL;

-- Class-only mode (section_id NULL): at most one assignment per (class, subject).
CREATE UNIQUE INDEX IF NOT EXISTS uq_teacher_assignments_class_subject_no_section
  ON public.teacher_assignments (class_id, subject_id)
  WHERE section_id IS NULL;
