-- Teacher assignments (optional section per class) + classes.has_sections flag
-- Run per tenant database.

-- 1) Class-level flag: "this class uses sections" when sections exist (admin can override via API)
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS has_sections BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.classes.has_sections IS
  'When true and the class has active sections, assignments require section_id; when false, section_id must be NULL.';

-- Backfill: classes with no sections → class-only mode
UPDATE public.classes c
SET has_sections = EXISTS (
  SELECT 1
  FROM public.sections s
  WHERE s.class_id = c.id
);

-- 2) Assignments table (section optional)
CREATE TABLE IF NOT EXISTS public.teacher_assignments (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  section_id INTEGER REFERENCES public.sections(id) ON DELETE RESTRICT,
  subject_id INTEGER NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_teacher ON public.teacher_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_class ON public.teacher_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_section ON public.teacher_assignments(section_id);

-- Uniqueness: with section
CREATE UNIQUE INDEX IF NOT EXISTS uq_teacher_assignments_with_section
  ON public.teacher_assignments (teacher_id, class_id, section_id, subject_id)
  WHERE section_id IS NOT NULL;

-- Uniqueness: class-only (section NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_teacher_assignments_no_section
  ON public.teacher_assignments (teacher_id, class_id, subject_id)
  WHERE section_id IS NULL;
