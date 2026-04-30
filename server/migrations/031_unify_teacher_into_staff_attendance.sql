BEGIN;

-- Teacher attendance is unified into staff_attendance (teachers are staff rows).
-- Legacy rows in teacher_attendance are copied only where no staff_attendance row exists yet.
DO $m$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'teacher_attendance'
  ) THEN
    INSERT INTO public.staff_attendance (
      staff_id,
      attendance_date,
      status,
      check_in_time,
      check_out_time,
      remark,
      marked_by,
      academic_year_id
    )
    SELECT
      t.staff_id,
      ta.attendance_date,
      ta.status,
      ta.check_in_time,
      ta.check_out_time,
      ta.remark,
      ta.marked_by,
      ta.academic_year_id
    FROM public.teacher_attendance ta
    INNER JOIN public.teachers t ON t.id = ta.teacher_id
    WHERE t.staff_id IS NOT NULL
    ON CONFLICT (staff_id, attendance_date) DO NOTHING;

    DROP TABLE public.teacher_attendance CASCADE;
  END IF;
END
$m$;

COMMIT;
