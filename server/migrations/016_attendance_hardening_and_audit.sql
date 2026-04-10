BEGIN;

-- Backfill student attendance metadata where safely derivable.
UPDATE public.attendance a
SET
  class_id = COALESCE(a.class_id, s.class_id),
  section_id = COALESCE(a.section_id, s.section_id),
  academic_year_id = COALESCE(a.academic_year_id, s.academic_year_id)
FROM public.students s
WHERE a.student_id = s.id
  AND (
    a.class_id IS NULL OR
    a.section_id IS NULL OR
    a.academic_year_id IS NULL
  );

-- Remove orphan rows that cannot participate in reliable joins/reports.
DELETE FROM public.attendance WHERE student_id IS NULL;
DELETE FROM public.teacher_attendance WHERE teacher_id IS NULL;
DELETE FROM public.staff_attendance WHERE staff_id IS NULL;

-- Enforce core entity integrity where now safe.
ALTER TABLE public.attendance ALTER COLUMN student_id SET NOT NULL;

-- Defensive constraints for future writes (leave class/section nullable for backward compatibility).
ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_class_section_required_check
  CHECK (
    (class_id IS NOT NULL AND section_id IS NOT NULL)
    OR status = 'holiday'
  ) NOT VALID;

-- Report-scale indexes.
CREATE INDEX IF NOT EXISTS idx_attendance_year_date ON public.attendance (academic_year_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_year_date ON public.teacher_attendance (academic_year_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_year_date ON public.staff_attendance (academic_year_id, attendance_date);

COMMIT;
