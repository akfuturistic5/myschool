BEGIN;

-- Align student attendance statuses with frontend and reports.
ALTER TABLE IF EXISTS public.attendance
  DROP CONSTRAINT IF EXISTS attendance_status_check;

ALTER TABLE IF EXISTS public.attendance
  ADD CONSTRAINT attendance_status_check
  CHECK (status IN ('present', 'absent', 'late', 'half_day', 'holiday'));

ALTER TABLE IF EXISTS public.attendance
  ADD CONSTRAINT attendance_time_order_check
  CHECK (check_out_time IS NULL OR check_in_time IS NULL OR check_out_time >= check_in_time);

CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance (attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_class_section_date ON public.attendance (class_id, section_id, attendance_date);

-- Teacher attendance: first-class storage instead of leave proxy.
CREATE TABLE IF NOT EXISTS public.teacher_attendance (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'late', 'half_day', 'holiday')),
  check_in_time TIME,
  check_out_time TIME,
  remark TEXT,
  marked_by INTEGER REFERENCES public.staff(id) ON DELETE SET NULL,
  academic_year_id INTEGER REFERENCES public.academic_years(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT teacher_attendance_time_order_check
    CHECK (check_out_time IS NULL OR check_in_time IS NULL OR check_out_time >= check_in_time),
  CONSTRAINT teacher_attendance_teacher_date_key UNIQUE (teacher_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_teacher_attendance_date ON public.teacher_attendance (attendance_date);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_year ON public.teacher_attendance (academic_year_id);

-- Staff attendance: first-class storage for non-teaching staff.
CREATE TABLE IF NOT EXISTS public.staff_attendance (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'late', 'half_day', 'holiday')),
  check_in_time TIME,
  check_out_time TIME,
  remark TEXT,
  marked_by INTEGER REFERENCES public.staff(id) ON DELETE SET NULL,
  academic_year_id INTEGER REFERENCES public.academic_years(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT staff_attendance_time_order_check
    CHECK (check_out_time IS NULL OR check_in_time IS NULL OR check_out_time >= check_in_time),
  CONSTRAINT staff_attendance_staff_date_key UNIQUE (staff_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_staff_attendance_date ON public.staff_attendance (attendance_date);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_year ON public.staff_attendance (academic_year_id);

COMMIT;
