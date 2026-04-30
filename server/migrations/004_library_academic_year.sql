-- Library: academic year scope for books and members (run after 002_library_module.sql).
-- Relaxes global unique student/staff member rows to one row per (person, academic year).

ALTER TABLE public.library_books
  ADD COLUMN IF NOT EXISTS academic_year_id integer;

ALTER TABLE public.library_members
  ADD COLUMN IF NOT EXISTS academic_year_id integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'library_books_academic_year_id_fkey'
  ) THEN
    ALTER TABLE public.library_books
      ADD CONSTRAINT library_books_academic_year_id_fkey
      FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'library_members_academic_year_id_fkey'
  ) THEN
    ALTER TABLE public.library_members
      ADD CONSTRAINT library_members_academic_year_id_fkey
      FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Backfill from current academic year, then any active year
UPDATE public.library_books b
SET academic_year_id = (SELECT id FROM public.academic_years WHERE is_current = true AND COALESCE(is_active, true) = true ORDER BY id LIMIT 1)
WHERE b.academic_year_id IS NULL;

UPDATE public.library_books b
SET academic_year_id = (SELECT id FROM public.academic_years WHERE COALESCE(is_active, true) = true ORDER BY start_date DESC NULLS LAST, id DESC LIMIT 1)
WHERE b.academic_year_id IS NULL;

UPDATE public.library_members m
SET academic_year_id = (SELECT id FROM public.academic_years WHERE is_current = true AND COALESCE(is_active, true) = true ORDER BY id LIMIT 1)
WHERE m.academic_year_id IS NULL;

UPDATE public.library_members m
SET academic_year_id = (SELECT id FROM public.academic_years WHERE COALESCE(is_active, true) = true ORDER BY start_date DESC NULLS LAST, id DESC LIMIT 1)
WHERE m.academic_year_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_library_books_academic_year ON public.library_books(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_library_members_academic_year ON public.library_members(academic_year_id);

-- One membership per student/staff per academic year (replaces single global unique on student/staff)
DROP INDEX IF EXISTS idx_library_members_one_student;
DROP INDEX IF EXISTS idx_library_members_one_staff;

CREATE UNIQUE INDEX IF NOT EXISTS idx_library_members_student_year
  ON public.library_members (student_id, academic_year_id)
  WHERE student_id IS NOT NULL AND academic_year_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_library_members_staff_year
  ON public.library_members (staff_id, academic_year_id)
  WHERE staff_id IS NOT NULL AND academic_year_id IS NOT NULL;

-- Book code unique within an academic year
DROP INDEX IF EXISTS idx_library_books_book_code;
CREATE UNIQUE INDEX IF NOT EXISTS idx_library_books_book_code_year
  ON public.library_books (book_code, academic_year_id)
  WHERE book_code IS NOT NULL AND trim(book_code::text) <> '' AND academic_year_id IS NOT NULL;
