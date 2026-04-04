-- =============================================================================
-- Migration: 002_create_student_promotions
-- =============================================================================
--
-- PURPOSE
--   Creates the audit/history table used by POST /api/students/promote
--   (studentController.promoteStudents). Each successful promotion inserts one row.
--
-- SOURCE OF TRUTH (aligned with)
--   - server/migrations/001_init_full_schema.sql (same columns, types, CHECK, FK names)
--   - server/src/controllers/studentController.js INSERT INTO student_promotions (...)
--
-- COLUMNS (all match 001_init_full_schema + app usage)
--   id                      PK, sequence-backed
--   student_id              Who was promoted (FK → students.id); nullable in legacy dump, app always sets
--   from_class_id           Previous class (FK → classes.id); may be NULL if student had no class
--   to_class_id             New class (FK → classes.id)
--   from_section_id         Previous section (FK → sections.id); may be NULL
--   to_section_id           New section (FK → sections.id)
--   from_academic_year_id   Previous year (FK → academic_years.id); may be NULL
--   to_academic_year_id     Target year (FK → academic_years.id)
--   promotion_date          Default CURRENT_DATE
--   status                  'promoted' | 'detained' | 'transferred' (CHECK)
--   remarks                 Optional text (app passes NULL today)
--   promoted_by             Staff who performed action (FK → staff.id); NULL if no staff row for user
--   is_active               Soft-flag; default true
--   created_at / modified_at Timestamps; defaults NOW() on insert / schema default
--   created_by              Optional audit user id (no FK in 001 template; left integer only)
--
-- PREREQUISITES (tenant DB)
--   public.students, public.classes, public.sections, public.academic_years, public.staff
--
-- IDEMPOTENCY
--   Sequence/table: IF NOT EXISTS.
--   Foreign keys: added only when constraint name is missing (safe re-run).
--   Indexes: IF NOT EXISTS.
--
-- PRODUCTION
--   psql:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/002_create_student_promotions.sql
--   Node:  npm run db:migrate:student-promotions
--
-- TROUBLESHOOTING
--   If a broken partial table exists, drop it first:
--     DROP TABLE IF EXISTS public.student_promotions CASCADE;
--     DROP SEQUENCE IF EXISTS public.student_promotions_id_seq CASCADE;
--   Then re-run this file.
--
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Sequence (same name and ownership pattern as 001_init_full_schema)
-- -----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.student_promotions_id_seq
    AS integer
    INCREMENT BY 1
    MINVALUE 1
    NO MAXVALUE
    START WITH 1
    CACHE 1;

-- -----------------------------------------------------------------------------
-- 2) Table + PK + status CHECK (matches 001_init_full_schema)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_promotions (
    id integer NOT NULL DEFAULT nextval('public.student_promotions_id_seq'::regclass),
    student_id integer,
    from_class_id integer,
    to_class_id integer,
    from_section_id integer,
    to_section_id integer,
    from_academic_year_id integer,
    to_academic_year_id integer,
    promotion_date date DEFAULT CURRENT_DATE,
    status character varying(20) DEFAULT 'promoted'::character varying,
    remarks text,
    promoted_by integer,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT student_promotions_pkey PRIMARY KEY (id),
    CONSTRAINT student_promotions_status_check CHECK (
        (status)::text = ANY (
            ARRAY[
                ('promoted'::character varying)::text,
                ('detained'::character varying)::text,
                ('transferred'::character varying)::text
            ]
        )
    )
);

-- -----------------------------------------------------------------------------
-- 3) Bind sequence to id column (idempotent if already set)
-- -----------------------------------------------------------------------------
ALTER SEQUENCE public.student_promotions_id_seq OWNED BY public.student_promotions.id;

-- -----------------------------------------------------------------------------
-- 4) Foreign keys (names match 001_init_full_schema for tooling / dumps)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'student_promotions_student_id_fkey'
    ) THEN
        ALTER TABLE public.student_promotions
            ADD CONSTRAINT student_promotions_student_id_fkey
            FOREIGN KEY (student_id) REFERENCES public.students (id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'student_promotions_from_class_id_fkey'
    ) THEN
        ALTER TABLE public.student_promotions
            ADD CONSTRAINT student_promotions_from_class_id_fkey
            FOREIGN KEY (from_class_id) REFERENCES public.classes (id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'student_promotions_to_class_id_fkey'
    ) THEN
        ALTER TABLE public.student_promotions
            ADD CONSTRAINT student_promotions_to_class_id_fkey
            FOREIGN KEY (to_class_id) REFERENCES public.classes (id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'student_promotions_from_section_id_fkey'
    ) THEN
        ALTER TABLE public.student_promotions
            ADD CONSTRAINT student_promotions_from_section_id_fkey
            FOREIGN KEY (from_section_id) REFERENCES public.sections (id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'student_promotions_to_section_id_fkey'
    ) THEN
        ALTER TABLE public.student_promotions
            ADD CONSTRAINT student_promotions_to_section_id_fkey
            FOREIGN KEY (to_section_id) REFERENCES public.sections (id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'student_promotions_from_academic_year_id_fkey'
    ) THEN
        ALTER TABLE public.student_promotions
            ADD CONSTRAINT student_promotions_from_academic_year_id_fkey
            FOREIGN KEY (from_academic_year_id) REFERENCES public.academic_years (id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'student_promotions_to_academic_year_id_fkey'
    ) THEN
        ALTER TABLE public.student_promotions
            ADD CONSTRAINT student_promotions_to_academic_year_id_fkey
            FOREIGN KEY (to_academic_year_id) REFERENCES public.academic_years (id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'student_promotions_promoted_by_fkey'
    ) THEN
        ALTER TABLE public.student_promotions
            ADD CONSTRAINT student_promotions_promoted_by_fkey
            FOREIGN KEY (promoted_by) REFERENCES public.staff (id);
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 5) Helpful indexes for reporting and student history (non-breaking)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_student_promotions_student_id
    ON public.student_promotions (student_id);

CREATE INDEX IF NOT EXISTS idx_student_promotions_to_academic_year_id
    ON public.student_promotions (to_academic_year_id);

CREATE INDEX IF NOT EXISTS idx_student_promotions_promotion_date
    ON public.student_promotions (promotion_date DESC);

-- -----------------------------------------------------------------------------
-- 6) Keep sequence aligned if table already had rows (no-op on empty table)
-- -----------------------------------------------------------------------------
SELECT setval(
    'public.student_promotions_id_seq',
    COALESCE((SELECT MAX(id) FROM public.student_promotions), 1),
    (SELECT MAX(id) FROM public.student_promotions) IS NOT NULL
);
