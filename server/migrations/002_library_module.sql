-- Library module incremental DDL (run after 001_init_full_schema.sql on tenant DBs).
-- Adds accession/book code on books and library_members for card-based registration.

ALTER TABLE public.library_books
  ADD COLUMN IF NOT EXISTS book_code character varying(50);

DROP INDEX IF EXISTS idx_library_books_book_code;
CREATE UNIQUE INDEX idx_library_books_book_code
  ON public.library_books (book_code)
  WHERE book_code IS NOT NULL AND trim(book_code) <> '';

CREATE SEQUENCE IF NOT EXISTS public.library_members_id_seq
  AS integer
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

CREATE TABLE IF NOT EXISTS public.library_members (
  id integer NOT NULL PRIMARY KEY DEFAULT nextval('public.library_members_id_seq'::regclass),
  member_type character varying(20) NOT NULL,
  student_id integer,
  staff_id integer,
  card_number character varying(50) NOT NULL,
  date_joined date DEFAULT CURRENT_DATE,
  is_active boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  created_by integer,
  modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT library_members_member_type_check CHECK (
    (member_type)::text = ANY (
      ARRAY[('student'::character varying)::text, ('staff'::character varying)::text]
    )
  ),
  CONSTRAINT library_members_student_or_staff_check CHECK (
    (
      member_type = 'student'::character varying
      AND student_id IS NOT NULL
      AND staff_id IS NULL
    )
    OR (
      member_type = 'staff'::character varying
      AND staff_id IS NOT NULL
      AND student_id IS NULL
    )
  )
);

ALTER SEQUENCE public.library_members_id_seq OWNED BY public.library_members.id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'library_members_card_number_key'
  ) THEN
    ALTER TABLE ONLY public.library_members ADD CONSTRAINT library_members_card_number_key UNIQUE (card_number);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'library_members_student_id_fkey'
  ) THEN
    ALTER TABLE ONLY public.library_members
      ADD CONSTRAINT library_members_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'library_members_staff_id_fkey'
  ) THEN
    ALTER TABLE ONLY public.library_members
      ADD CONSTRAINT library_members_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_library_members_one_student;
CREATE UNIQUE INDEX idx_library_members_one_student
  ON public.library_members (student_id)
  WHERE student_id IS NOT NULL;

DROP INDEX IF EXISTS idx_library_members_one_staff;
CREATE UNIQUE INDEX idx_library_members_one_staff
  ON public.library_members (staff_id)
  WHERE staff_id IS NOT NULL;
