-- Normalized Schema Definitions (Ultimate Integrity Version)
-- Enforces absolute logical correctness via Triple-Key Composite Foreign Keys.

-- 1. Classes (Master)
CREATE TABLE IF NOT EXISTS public.classes (
    id SERIAL PRIMARY KEY,
    class_name character varying(50) NOT NULL,
    class_code character varying(10),
    max_students integer DEFAULT 30,
    class_fee numeric(10,2),
    description text,
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 2. Subjects (Master)
CREATE TABLE IF NOT EXISTS public.subjects (
    id SERIAL PRIMARY KEY,
    subject_name character varying(100) NOT NULL,
    subject_code character varying(10),
    theory_hours integer DEFAULT 0,
    practical_hours integer DEFAULT 0,
    total_marks integer DEFAULT 100,
    passing_marks integer DEFAULT 35,
    description text,
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 3. Sections (Master - Labels)
CREATE TABLE IF NOT EXISTS public.sections (
    id SERIAL PRIMARY KEY,
    section_name character varying(50) NOT NULL,
    description text,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Class Sections (Instance - Triple-Key Anchor)
CREATE TABLE IF NOT EXISTS public.class_sections (
    id SERIAL PRIMARY KEY,
    class_id integer NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
    section_id integer NOT NULL REFERENCES public.sections(id) ON DELETE RESTRICT,
    academic_year_id INTEGER NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    max_students integer DEFAULT 30,
    room_number character varying(20),
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    -- TRIPLE-KEY ANCHOR
    CONSTRAINT uq_class_section_anchor UNIQUE (id, class_id, academic_year_id)
);

-- Partial index for uniqueness (ignoring deleted records)
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_class_section 
ON public.class_sections (class_id, section_id, academic_year_id) 
WHERE deleted_at IS NULL;

-- 5. Class Subjects (Curriculum - Triple-Key Anchor)
CREATE TABLE IF NOT EXISTS public.class_subjects (
    id SERIAL PRIMARY KEY,
    class_id INTEGER NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
    subject_id INTEGER NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
    academic_year_id INTEGER NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    is_elective BOOLEAN NOT NULL DEFAULT FALSE,
    theory_hours integer DEFAULT 0,
    practical_hours integer DEFAULT 0,
    total_marks integer DEFAULT 100,
    passing_marks integer DEFAULT 35,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    -- TRIPLE-KEY ANCHOR
    CONSTRAINT uq_class_subject_anchor UNIQUE (id, class_id, academic_year_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_class_subject 
ON public.class_subjects (class_id, subject_id, academic_year_id) 
WHERE deleted_at IS NULL;

-- 6. Class Teachers (Ultimate Integrity)
CREATE TABLE IF NOT EXISTS public.class_teachers (
    id SERIAL PRIMARY KEY,
    class_id INTEGER NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
    class_section_id INTEGER,
    staff_id INTEGER NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
    academic_year_id INTEGER NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    role VARCHAR(50) DEFAULT 'primary',
    valid_period DATERANGE NOT NULL DEFAULT daterange(CURRENT_DATE, '9999-12-31', '[]'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    -- TRIPLE-KEY ENFORCEMENT: Section MUST belong to the same Class and Year
    FOREIGN KEY (class_section_id, class_id, academic_year_id) 
        REFERENCES public.class_sections(id, class_id, academic_year_id),
    
    CONSTRAINT class_xor_section CHECK (
        (class_section_id IS NOT NULL) OR (class_id IS NOT NULL)
    )
);

-- Temporal Overlap Prevention with Year Context
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE public.class_teachers ADD CONSTRAINT exclude_overlapping_primary_class_teachers
EXCLUDE USING GIST (
    COALESCE(class_section_id, 0) WITH =,
    class_id WITH =,
    academic_year_id WITH =,
    valid_period WITH &&
) WHERE (role = 'primary' AND deleted_at IS NULL);

-- 7. Subject Teacher Assignments (Ultimate Integrity)
CREATE TABLE IF NOT EXISTS public.subject_teacher_assignments (
    id SERIAL PRIMARY KEY,
    class_id INTEGER NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
    class_section_id INTEGER,
    class_subject_id INTEGER NOT NULL,
    staff_id INTEGER NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
    academic_year_id INTEGER NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    valid_period DATERANGE NOT NULL DEFAULT daterange(CURRENT_DATE, '9999-12-31', '[]'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    -- TRIPLE-KEY ENFORCEMENT: Section, Subject, Class, and Year must perfectly align
    FOREIGN KEY (class_section_id, class_id, academic_year_id) 
        REFERENCES public.class_sections(id, class_id, academic_year_id),
    FOREIGN KEY (class_subject_id, class_id, academic_year_id) 
        REFERENCES public.class_subjects(id, class_id, academic_year_id)
);

-- Overlap Prevention for Subject Assignments
ALTER TABLE public.subject_teacher_assignments ADD CONSTRAINT exclude_overlapping_subject_assignments
EXCLUDE USING GIST (
    COALESCE(class_section_id, 0) WITH =,
    class_subject_id WITH =,
    class_id WITH =,
    academic_year_id WITH =,
    valid_period WITH &&
) WHERE (deleted_at IS NULL);

-- 8. Student Subject Choices (Ultimate Integrity)
CREATE TABLE IF NOT EXISTS public.student_subject_choices (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    class_id INTEGER NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
    class_subject_id INTEGER NOT NULL,
    academic_year_id INTEGER NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    -- TRIPLE-KEY ENFORCEMENT
    FOREIGN KEY (class_subject_id, class_id, academic_year_id) 
        REFERENCES public.class_subjects(id, class_id, academic_year_id),
        
    UNIQUE(student_id, class_subject_id, academic_year_id) WHERE deleted_at IS NULL
);

-- 9. Performance Indexes
CREATE INDEX idx_class_subjects_anchor ON public.class_subjects(class_id, academic_year_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_class_sections_anchor ON public.class_sections(class_id, academic_year_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_class_teachers_triple ON public.class_teachers(class_id, class_section_id, academic_year_id) WHERE deleted_at IS NULL;
