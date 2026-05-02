-- 0. Extensions & History
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS public.migration_history (
    id SERIAL PRIMARY KEY,
    migration_name character varying(255) NOT NULL UNIQUE,
    batch integer,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure batch column exists for existing databases
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='migration_history' AND column_name='batch') THEN
        ALTER TABLE public.migration_history ADD COLUMN batch integer;
    END IF;
END $$;

-- 0. Academic Years (Temporal Anchor Master)
CREATE TABLE IF NOT EXISTS public.academic_years (
    id SERIAL PRIMARY KEY,
    year_name character varying(20) NOT NULL UNIQUE, -- e.g. 2024-25
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_current boolean DEFAULT false,
    is_active boolean DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER,
    updated_by INTEGER,
    
    -- Zero-Overlap Integrity: No two academic years can overlap
    CONSTRAINT uq_academic_year_period_no_overlap
    EXCLUDE USING GIST (daterange(start_date, end_date, '[]') WITH &&),
    
    CONSTRAINT academic_years_date_check CHECK (start_date <= end_date)
);

-- Singleton Constraint: Only one academic year can be current
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_current_academic_year 
ON public.academic_years (is_current) 
WHERE is_current = true;


-- =============================================================================
-- MASTER & IDENTITY LAYERS
-- =============================================================================

-- 18. User Roles (Master)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id SERIAL PRIMARY KEY,
    role_name character varying(50) NOT NULL UNIQUE,
    description text,
    permissions jsonb,
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER,
    updated_by INTEGER
);

-- 19. Blood Groups (Master)
CREATE TABLE IF NOT EXISTS public.blood_groups (
    id SERIAL PRIMARY KEY,
    blood_group_name character varying(10) NOT NULL UNIQUE,
    description text,
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER,
    updated_by INTEGER
);

-- 20. Religions (Master)
CREATE TABLE IF NOT EXISTS public.religions (
    id SERIAL PRIMARY KEY,
    religion_name character varying(50) NOT NULL UNIQUE,
    description text,
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER,
    updated_by INTEGER
);

-- 21. Casts (Master)
CREATE TABLE IF NOT EXISTS public.casts (
    id SERIAL PRIMARY KEY,
    cast_name character varying(100) NOT NULL UNIQUE,
    religion_id integer REFERENCES public.religions(id),
    description text,
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER,
    updated_by INTEGER
);

-- 22. Mother Tongues (Master)
CREATE TABLE IF NOT EXISTS public.mother_tongues (
    id SERIAL PRIMARY KEY,
    language_name character varying(50) NOT NULL UNIQUE,
    description text,
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER,
    updated_by INTEGER
);

-- 23. Houses (Master)
CREATE TABLE IF NOT EXISTS public.houses (
    id SERIAL PRIMARY KEY,
    house_name character varying(50) NOT NULL UNIQUE,
    description text,
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER,
    updated_by INTEGER
);

-- 24. Users (Central Identity Layer)
CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    username character varying(50) NOT NULL UNIQUE,
    email character varying(100) UNIQUE,
    password_hash character varying(255) NOT NULL,
    role_id integer REFERENCES public.user_roles(id),
    first_name character varying(50),
    last_name character varying(50),
    gender character varying(10),
    date_of_birth date,
    blood_group_id integer REFERENCES public.blood_groups(id),
    phone character varying(15),
    current_address text,
    permanent_address text,
    facebook text,
    twitter text,
    linkedin text,
    youtube text,
    instagram text,
    occupation character varying(255),
    avatar text DEFAULT '',
    last_login TIMESTAMPTZ,
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by INTEGER,
    updated_by INTEGER,
    
    CONSTRAINT users_gender_check CHECK (gender IN ('male', 'female', 'other'))
);

-- 48. Leave Types (Master)
CREATE TABLE IF NOT EXISTS public.leave_types (
    id SERIAL PRIMARY KEY,
    leave_type character varying(50) NOT NULL UNIQUE,
    code character varying(10) UNIQUE,
    max_days integer,
    description text,
    is_paid boolean DEFAULT true,
    applicable_for character varying(20), -- student, staff, both
    requires_medical_certificate boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT leave_types_applicable_for_check CHECK (applicable_for IN ('student', 'staff', 'both'))
);

-- 91. Room Types (Master)
CREATE TABLE IF NOT EXISTS public.room_types (
    id SERIAL PRIMARY KEY,
    room_type character varying(50) NOT NULL UNIQUE,
    description text,
    max_occupancy integer,
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 95. Languages (Master)
CREATE TABLE IF NOT EXISTS public.languages (
    id SERIAL PRIMARY KEY,
    language_name character varying(50) NOT NULL UNIQUE,
    language_code character varying(10),
    is_compulsory boolean DEFAULT false,
    description text,
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Fee Types (Master)
CREATE TABLE IF NOT EXISTS public.fees_types (
    id SERIAL PRIMARY KEY,
    name character varying(100) NOT NULL,
    code character varying(20),
    description text,
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER,
    updated_by INTEGER
);

-- 58. Library Categories (Master)
CREATE TABLE IF NOT EXISTS public.library_categories (
    id SERIAL PRIMARY KEY,
    category_name character varying(100) NOT NULL,
    description text,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_library_category_name ON public.library_categories (category_name) WHERE (deleted_at IS NULL);

-- 81. Document Types (Master)
CREATE TABLE IF NOT EXISTS public.document_types (
    id SERIAL PRIMARY KEY,
    document_type character varying(50) NOT NULL,
    description character varying(200),
    is_mandatory boolean DEFAULT false,
    applicable_for character varying(20), -- student, staff, both
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by integer,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT document_types_applicable_for_check CHECK (applicable_for IN ('student', 'staff', 'both'))
);

-- 25. Departments (Master)
CREATE TABLE IF NOT EXISTS public.departments (
    id SERIAL PRIMARY KEY,
    department_name character varying(100) NOT NULL UNIQUE,
    department_code character varying(10),
    head_of_department integer, -- Will reference staff.id later
    description text,
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER,
    updated_by INTEGER
);

-- 26. Designations (Master)
CREATE TABLE IF NOT EXISTS public.designations (
    id SERIAL PRIMARY KEY,
    designation_name character varying(100) NOT NULL,
    department_id integer REFERENCES public.departments(id),
    salary_range_min numeric(12,2),
    salary_range_max numeric(12,2),
    description text,
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER,
    updated_by INTEGER
);

-- 27. Staff (Professional Layer)
CREATE TABLE IF NOT EXISTS public.staff (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    employee_code character varying(20) NOT NULL UNIQUE,
    marital_status character varying(20),
    father_name character varying(100),
    mother_name character varying(100),
    id_number character varying(50), -- Aadhar/Voter ID
    emergency_contact_name character varying(100),
    emergency_contact_phone character varying(15),
    license_number character varying(50),
    license_expiry date,
    license_photo_url character varying(500),
    designation_id integer REFERENCES public.designations(id),
    department_id integer REFERENCES public.departments(id),
    joining_date date,
    qualification text,
    experience_years integer,
    languages_known text[],
    other_info text,
    previous_school_name character varying(200),
    previous_school_address text,
    previous_school_phone character varying(15),
    photo_url character varying(500),
    status character varying(20) DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by integer,
    updated_by integer,
    
    CONSTRAINT staff_marital_status_check CHECK (marital_status IN ('Single', 'Married', 'Divorced', 'Widowed'))
);

-- App code filters on staff.is_active; the canonical model is status + deleted_at.
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS is_active boolean
  GENERATED ALWAYS AS (
    (deleted_at IS NULL AND LOWER(TRIM(COALESCE(status, 'Active'))) = 'active')
  ) STORED;

-- 28. Salary Components (Master Layer)
CREATE TABLE IF NOT EXISTS public.salary_components (
    id SERIAL PRIMARY KEY,
    component_name character varying(100) NOT NULL,
    type character varying(20) NOT NULL, -- allowance, deduction
    description text,
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by integer,
    updated_by integer,
    
    CONSTRAINT salary_component_type_check CHECK (type IN ('allowance', 'deduction'))
);

-- 29. Staff Salary Assignments (Temporal Layer)
CREATE TABLE IF NOT EXISTS public.staff_salary_assignments (
    id SERIAL PRIMARY KEY,
    staff_id integer NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    basic_salary numeric(12,2) NOT NULL DEFAULT 0.00,
    epf_no character varying(50),
    pan_number character varying(10),
    bank_name text,
    account_name character varying(100),
    account_no text,
    branch text,
    ifsc_code text,
    contract_type text,
    shift text,
    work_location text,
    valid_period daterange NOT NULL, -- Temporal Anchor
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by integer,
    updated_by integer,
    
    -- Prevent overlapping salary assignments for the same staff member
    CONSTRAINT exclude_overlapping_salary_assignments
    EXCLUDE USING GIST (staff_id WITH =, valid_period WITH &&)
);

-- 30. Staff Salary Component Values (Detail Layer)
CREATE TABLE IF NOT EXISTS public.staff_salary_component_values (
    salary_assignment_id integer NOT NULL REFERENCES public.staff_salary_assignments(id) ON DELETE CASCADE,
    component_id integer NOT NULL REFERENCES public.salary_components(id) ON DELETE RESTRICT,
    amount numeric(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (salary_assignment_id, component_id)
);

-- 31. Staff Payslips (Immutable Ledger Layer)
CREATE TABLE IF NOT EXISTS public.staff_payslips (
    id SERIAL PRIMARY KEY,
    staff_id integer NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    salary_assignment_id integer REFERENCES public.staff_salary_assignments(id) ON DELETE SET NULL,
    salary_period daterange NOT NULL, -- Frozen period for the payslip
    
    -- SNAPSHOT INTEGRITY: Frozen values at time of generation
    basic_salary_snapshot numeric(12,2) NOT NULL,
    allowances_snapshot jsonb DEFAULT '[]'::jsonb,
    deductions_snapshot jsonb DEFAULT '[]'::jsonb,
    
    gross_amount numeric(12,2) NOT NULL,
    net_amount numeric(12,2) NOT NULL,
    
    payment_date date,
    payment_mode character varying(20), -- Bank, Cash, Cheque, UPI
    transaction_id character varying(100),
    status character varying(20) DEFAULT 'Draft',
    remarks text,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by integer,
    updated_by integer,
    
    CONSTRAINT staff_payslip_status_check CHECK (status IN ('Draft', 'Generated', 'Paid', 'Cancelled'))
);

-- Uniqueness constraint: One payslip per staff per period (excluding cancelled)
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_payslip_period 
ON public.staff_payslips (staff_id, salary_period) 
WHERE (status != 'Cancelled');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_salary_assignments_staff ON public.staff_salary_assignments(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_payslips_period ON public.staff_payslips USING GIST (salary_period);
CREATE INDEX IF NOT EXISTS idx_staff_payslips_staff_period ON public.staff_payslips(staff_id, salary_period);


-- 32. Students (Academic Layer)
CREATE TABLE IF NOT EXISTS public.students (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    admission_number character varying(20) NOT NULL UNIQUE,
    roll_number character varying(20),
    gr_number character varying(30) NOT NULL,
    pen_number character varying(20) NOT NULL,
    aadhar_no character varying(12) NOT NULL,
    unique_student_ids character varying(50), -- School Board ID
    admission_date date DEFAULT CURRENT_DATE,
    place_of_birth character varying(100),
    nationality character varying(50) DEFAULT 'Indian',
    
    -- Demographic Links
    blood_group_id integer REFERENCES public.blood_groups(id),
    religion_id integer REFERENCES public.religions(id),
    cast_id integer REFERENCES public.casts(id),
    mother_tongue_id integer REFERENCES public.mother_tongues(id),
    house_id integer REFERENCES public.houses(id),
    
    -- Documents
    transfer_certificate_path character varying(500),
    
    -- Previous School Details
    previous_school_name character varying(200),
    previous_school_address text,
    
    -- Bank Info (Student's own account if any)
    bank_name text,
    branch text,
    ifsc_code text,
    account_no text,
    
    -- Status
    status character varying(20) DEFAULT 'Active',
    is_active boolean DEFAULT true,
    other_info text,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by integer,
    updated_by integer
);

-- 33. Guardians (Professional Layer)
CREATE TABLE IF NOT EXISTS public.guardians (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    annual_income numeric(12,2),
    office_address text,
    other_info text,
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by integer,
    updated_by integer
);

-- 34. Student-Guardian Links (Relationship Layer)
CREATE TABLE IF NOT EXISTS public.student_guardian_links (
    id SERIAL PRIMARY KEY,
    student_id integer NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    guardian_id integer NOT NULL REFERENCES public.guardians(id) ON DELETE CASCADE,
    relation character varying(30) NOT NULL, -- Father, Mother, Guardian, etc.
    is_primary_contact boolean DEFAULT false,
    is_emergency_contact boolean DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by integer,
    updated_by integer,
    
    -- Ensure a student doesn't have duplicate links to same person
    UNIQUE (student_id, guardian_id)
);

-- Ensure only one primary contact per student
CREATE UNIQUE INDEX IF NOT EXISTS uq_primary_guardian_per_student 
ON public.student_guardian_links (student_id) 
WHERE is_primary_contact = true;

-- 35. Student Medical Records (Health Layer)
CREATE TABLE IF NOT EXISTS public.student_medical_records (
    id SERIAL PRIMARY KEY,
    student_id integer NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    record_type character varying(50) NOT NULL, -- Allergy, Chronic Condition, etc.
    condition_name character varying(100) NOT NULL,
    severity character varying(20), -- Low, Medium, High, Critical
    medications text,
    notes text,
    medical_document_path character varying(500),
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by integer,
    updated_by integer
);

-- 36. Student Transport Assignments (Logistics Layer)
CREATE TABLE IF NOT EXISTS public.student_transport_assignments (
    id SERIAL PRIMARY KEY,
    student_id integer NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    academic_year_id integer NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    route_id integer,
    pickup_point_id integer,
    valid_from date DEFAULT CURRENT_DATE,
    valid_to date,
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by integer,
    updated_by integer
);

-- 37. Student Hostel Assignments (Logistics Layer)
CREATE TABLE IF NOT EXISTS public.student_hostel_assignments (
    id SERIAL PRIMARY KEY,
    student_id integer NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    academic_year_id integer NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    hostel_id integer,
    hostel_room_id integer,
    bed_number character varying(20),
    valid_from date DEFAULT CURRENT_DATE,
    valid_to date,
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by integer,
    updated_by integer
);

-- =============================================================================
-- ACADEMIC & FINANCIAL LAYERS
-- =============================================================================

-- 1. Classes (Master)
CREATE TABLE IF NOT EXISTS public.classes (
    id SERIAL PRIMARY KEY,
    class_name character varying(50) NOT NULL,
    class_code character varying(10),
    max_students integer DEFAULT 30,
    description text,
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by INTEGER,
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
    updated_by INTEGER,
    deleted_at TIMESTAMPTZ
);

-- 3. Sections (Master - Labels)
CREATE TABLE IF NOT EXISTS public.sections (
    id SERIAL PRIMARY KEY,
    section_name character varying(50) NOT NULL,
    description text,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER,
    updated_by INTEGER
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
    updated_by INTEGER,
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
    updated_by INTEGER,
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
    updated_by INTEGER,
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
    updated_by INTEGER,
    deleted_at TIMESTAMPTZ,
    
    FOREIGN KEY (class_subject_id, class_id, academic_year_id) 
        REFERENCES public.class_subjects(id, class_id, academic_year_id),
        
    -- ULTIMATE INTEGRITY ANCHOR (Used for locking teachers to their specific assignments)
    CONSTRAINT uq_subject_teacher_assignment_anchor 
        UNIQUE (id, staff_id, class_section_id, class_subject_id, academic_year_id)
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
    updated_by INTEGER,
    deleted_at TIMESTAMPTZ,
    
    -- TRIPLE-KEY ENFORCEMENT
    FOREIGN KEY (class_subject_id, class_id, academic_year_id) 
        REFERENCES public.class_subjects(id, class_id, academic_year_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_subject_choice 
ON public.student_subject_choices (student_id, class_subject_id, academic_year_id) 
WHERE deleted_at IS NULL;

-- 9. Performance Indexes
CREATE INDEX idx_class_subjects_anchor ON public.class_subjects(class_id, academic_year_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_class_sections_anchor ON public.class_sections(class_id, academic_year_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_class_teachers_triple ON public.class_teachers(class_id, class_section_id, academic_year_id) WHERE deleted_at IS NULL;


-- 11. Fees (Configuration Header)
CREATE TABLE IF NOT EXISTS public.fees (
    id SERIAL PRIMARY KEY,
    class_id integer NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
    academic_year_id integer NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    due_date date, -- Default due date for the entire fee if no installments
    late_fee_type character varying(20) DEFAULT 'fixed',
    late_fee_charge numeric(12,2) DEFAULT 0.00,
    late_fee_frequency character varying(20) DEFAULT 'once',
    description text,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER,
    updated_by INTEGER,
    deleted_at TIMESTAMPTZ,
    
    -- TRIPLE-KEY ANCHOR
    CONSTRAINT uq_fee_anchor UNIQUE (id, class_id, academic_year_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_one_fee_per_class_year 
ON public.fees (class_id, academic_year_id) 
WHERE deleted_at IS NULL;

-- 12. Fees Class Types (Configuration Details)
CREATE TABLE IF NOT EXISTS public.fees_class_types (
    id SERIAL PRIMARY KEY,
    fee_id integer NOT NULL,
    class_id integer NOT NULL,
    academic_year_id integer NOT NULL,
    fee_type_id integer NOT NULL REFERENCES public.fees_types(id) ON DELETE RESTRICT,
    amount numeric(12,2) NOT NULL DEFAULT 0.00,
    is_optional boolean DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER,
    updated_by INTEGER,
    
    -- TRIPLE-KEY ENFORCEMENT
    FOREIGN KEY (fee_id, class_id, academic_year_id) 
        REFERENCES public.fees(id, class_id, academic_year_id) ON DELETE CASCADE
);

-- 13. Fees Installments (Payment Schedule)
CREATE TABLE IF NOT EXISTS public.fees_installments (
    id SERIAL PRIMARY KEY,
    fee_id integer NOT NULL,
    class_id integer NOT NULL,
    academic_year_id integer NOT NULL,
    installment_name character varying(100) NOT NULL,
    due_date date NOT NULL,
    amount numeric(12,2) NOT NULL DEFAULT 0.00,
    late_fee_type character varying(20) DEFAULT 'fixed', -- 'fixed' or 'percentage'
    late_fee_charge numeric(12,2) DEFAULT 0.00,
    late_fee_frequency character varying(20) DEFAULT 'once', -- 'once', 'daily', 'weekly', 'monthly'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER,
    updated_by INTEGER,
    
    -- TRIPLE-KEY ENFORCEMENT
    FOREIGN KEY (fee_id, class_id, academic_year_id) 
        REFERENCES public.fees(id, class_id, academic_year_id) ON DELETE CASCADE
);

-- 14. Fees Paids (Student Ledger Summary)
CREATE TABLE IF NOT EXISTS public.fees_paids (
    id SERIAL PRIMARY KEY,
    student_id integer NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    class_id integer NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
    academic_year_id integer NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    total_payable numeric(12,2) NOT NULL DEFAULT 0.00,
    total_paid numeric(12,2) NOT NULL DEFAULT 0.00,
    balance_amount numeric(12,2) NOT NULL DEFAULT 0.00,
    status character varying(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER,
    updated_by INTEGER,
    
    -- TRIPLE-KEY ANCHOR
    CONSTRAINT uq_fees_paid_anchor UNIQUE (id, student_id, academic_year_id),
    UNIQUE(student_id, academic_year_id)
);

-- 15. Compulsory Fees (Transaction Records)
CREATE TABLE IF NOT EXISTS public.compulsory_fees (
    id SERIAL PRIMARY KEY,
    student_id integer NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    academic_year_id integer NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    fee_id integer REFERENCES public.fees(id),
    fee_installment_id integer REFERENCES public.fees_installments(id),
    amount_paid numeric(12,2) NOT NULL,
    advance_amount_used numeric(12,2) DEFAULT 0.00, -- Amount settled from fees_advance
    fine_paid numeric(12,2) DEFAULT 0.00,
    payment_date date DEFAULT CURRENT_DATE,
    payment_mode character varying(20) DEFAULT 'Cash',
    transaction_id character varying(100),
    remarks text,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER,
    updated_by INTEGER,
    
    CONSTRAINT payment_has_context CHECK (fee_id IS NOT NULL OR fee_installment_id IS NOT NULL)
);

-- 16. Optional Fees (Transaction Records)
CREATE TABLE IF NOT EXISTS public.optional_fees (
    id SERIAL PRIMARY KEY,
    student_id integer NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    academic_year_id integer NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    fee_class_type_id integer NOT NULL REFERENCES public.fees_class_types(id),
    amount_paid numeric(12,2) NOT NULL,
    advance_amount_used numeric(12,2) DEFAULT 0.00, -- Amount settled from fees_advance
    payment_date date DEFAULT CURRENT_DATE,
    payment_mode character varying(20) DEFAULT 'Cash',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by INTEGER
);

-- 17. Fees Advance (Credit Bucket)
CREATE TABLE IF NOT EXISTS public.fees_advance (
    id SERIAL PRIMARY KEY,
    student_id integer NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    academic_year_id integer NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    fees_paid_id integer REFERENCES public.fees_paids(id), -- Link to student's current ledger
    amount numeric(12,2) NOT NULL DEFAULT 0.00,
    source_receipt_no character varying(50), -- Optional: Track which receipt created this advance
    remarks text,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER,
    updated_by INTEGER,
    
    -- Ensure advance is scoped to the student and session
    CONSTRAINT uq_student_advance_session UNIQUE (student_id, academic_year_id)
);


-- 38. Student Lifecycle Ledger (Source of Truth)
CREATE TABLE IF NOT EXISTS public.student_lifecycle_ledger (
    id SERIAL PRIMARY KEY,
    student_id integer NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    event_type character varying(20) NOT NULL, -- ADMISSION, PROMOTE, DETAIN, LEAVE, REJOIN, TRANSFER
    from_academic_year_id integer REFERENCES public.academic_years(id),
    to_academic_year_id integer REFERENCES public.academic_years(id),
    from_class_id integer REFERENCES public.classes(id),
    to_class_id integer REFERENCES public.classes(id),
    from_section_id integer REFERENCES public.sections(id),
    to_section_id integer REFERENCES public.sections(id),
    event_date date DEFAULT CURRENT_DATE,
    result_status character varying(20), -- Pass, Fail, N/A
    reason text,
    remarks text,
    processed_by integer REFERENCES public.staff(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by integer,
    updated_by integer,
    
    CONSTRAINT ledger_event_type_check CHECK (event_type IN ('ADMISSION', 'PROMOTE', 'DETAIN', 'LEAVE', 'REJOIN', 'TRANSFER')),
    
    -- TRIPLE-KEY ANCHORS: Allows other tables to lock their records to a specific enrollment state
    -- Full context (Class-level)
    CONSTRAINT uq_student_lifecycle_full UNIQUE (id, student_id, to_academic_year_id, to_class_id),
    -- Broad context (Year-level)
    CONSTRAINT uq_student_lifecycle_year UNIQUE (id, student_id, to_academic_year_id)
);

-- 39. Student Siblings (External)
CREATE TABLE IF NOT EXISTS public.student_siblings (
    id SERIAL PRIMARY KEY,
    student_id integer NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    name text NOT NULL,
    class_name character varying(50),
    section_name character varying(50),
    roll_number character varying(20),
    admission_number character varying(20),
    school_name character varying(200),
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by integer,
    updated_by integer
);

-- 40. Exam Grades (Master Layer)
CREATE TABLE IF NOT EXISTS public.exam_grades (
    id SERIAL PRIMARY KEY,
    grade_name character varying(10) NOT NULL UNIQUE,
    min_percentage numeric(5,2) NOT NULL,
    max_percentage numeric(5,2) NOT NULL,
    point_value numeric(4,2), -- For GPA calculations
    description text,
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by integer,
    updated_by integer,
    
    CONSTRAINT exam_grades_percentage_range CHECK (max_percentage >= min_percentage)
);

-- 41. Exams (Core Header Layer)
CREATE TABLE IF NOT EXISTS public.exams (
    id SERIAL PRIMARY KEY,
    exam_name character varying(150) NOT NULL,
    exam_type character varying(30) NOT NULL, -- Unit Test, Monthly, Annual, etc.
    academic_year_id integer NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    description text,
    is_finalized boolean DEFAULT false,
    finalized_at TIMESTAMPTZ,
    finalized_by integer REFERENCES public.staff(id),
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by integer,
    updated_by integer,
    
    CONSTRAINT exams_exam_type_check CHECK (
        exam_type IN ('unit_test', 'monthly', 'quarterly', 'half_yearly', 'annual', 'preboard', 'internal', 'other')
    )
);

-- 42. Exam Classes (Participation Layer)
CREATE TABLE IF NOT EXISTS public.exam_classes (
    exam_id integer NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    class_id integer NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    PRIMARY KEY (exam_id, class_id)
);

-- 43. Exam Schedules (Flexible Timetable Layer)
CREATE TABLE IF NOT EXISTS public.exam_schedules (
    id SERIAL PRIMARY KEY,
    exam_id integer NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    academic_year_id integer NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    class_id integer NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
    class_section_id integer REFERENCES public.class_sections(id) ON DELETE CASCADE,
    class_subject_id integer NOT NULL REFERENCES public.class_subjects(id) ON DELETE RESTRICT,
    exam_date date,
    start_time time without time zone,
    end_time time without time zone,
    max_marks numeric(7,2) NOT NULL CHECK (max_marks > 0),
    passing_marks numeric(7,2) NOT NULL CHECK (passing_marks >= 0),
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by integer,
    updated_by integer,
    
    CONSTRAINT exam_schedules_marks_check CHECK (passing_marks <= max_marks),
    CONSTRAINT exam_schedules_time_order CHECK (start_time IS NULL OR end_time IS NULL OR end_time > start_time)
);

-- Specific Section Schedule Unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS uq_exam_schedule_section 
ON public.exam_schedules (exam_id, class_id, class_section_id, class_subject_id, academic_year_id) 
WHERE class_section_id IS NOT NULL;

-- Grade-wide Fallback Schedule Unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS uq_exam_schedule_grade 
ON public.exam_schedules (exam_id, class_id, class_subject_id, academic_year_id) 
WHERE class_section_id IS NULL;

-- 44. Exam Results (Lean Results Layer)
CREATE TABLE IF NOT EXISTS public.exam_results (
    id SERIAL PRIMARY KEY,
    exam_schedule_id integer NOT NULL REFERENCES public.exam_schedules(id) ON DELETE CASCADE,
    student_id integer NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    marks_obtained numeric(7,2),
    is_absent boolean DEFAULT false,
    grade_id integer REFERENCES public.exam_grades(id) ON DELETE SET NULL,
    remarks text,
    entered_by integer REFERENCES public.staff(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by integer,
    updated_by integer,
    
    -- Ensure only one result per student per schedule entry
    UNIQUE (student_id, exam_schedule_id),
    
    CONSTRAINT exam_results_absent_marks_check CHECK (
        (NOT is_absent) OR (marks_obtained IS NULL OR marks_obtained = 0)
    )
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_exam_results_student ON public.exam_results(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_schedules_exam ON public.exam_schedules(exam_id, academic_year_id);

-- 45. Timetable Time Slots (Master Layer)
CREATE TABLE IF NOT EXISTS public.timetable_time_slots (
    id SERIAL PRIMARY KEY,
    slot_name character varying(50) NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    is_break boolean DEFAULT false,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by integer,
    updated_by integer,
    
    CONSTRAINT timetable_time_slots_time_check CHECK (end_time > start_time),
    UNIQUE (start_time, end_time)
);

-- 46. Class Rooms (Asset Layer)
CREATE TABLE IF NOT EXISTS public.class_rooms (
    id SERIAL PRIMARY KEY,
    room_name character varying(50) NOT NULL UNIQUE,
    room_type_id integer REFERENCES public.room_types(id), 
    building_name character varying(100),
    floor integer,
    capacity integer,
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by integer,
    updated_by integer
);

-- 47. Class Schedules (Temporal Scheduling Layer)
CREATE TABLE IF NOT EXISTS public.class_schedules (
    id SERIAL PRIMARY KEY,
    academic_year_id integer NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    class_id integer NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
    class_section_id integer NOT NULL,
    class_subject_id integer NOT NULL,
    teacher_id integer NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
    class_room_id integer NOT NULL REFERENCES public.class_rooms(id) ON DELETE RESTRICT,
    time_slot_id integer NOT NULL REFERENCES public.timetable_time_slots(id) ON DELETE RESTRICT,
    day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    
    -- Temporal Versioning
    valid_from date NOT NULL,
    valid_to date,
    
    remarks text,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by integer,
    updated_by integer,
    
    CONSTRAINT class_schedules_valid_to_check CHECK (valid_to IS NULL OR valid_to > valid_from),
    
    -- TRIPLE-KEY INTEGRITY: Locking Section and Subject to Class and Year
    CONSTRAINT fk_class_schedules_section 
        FOREIGN KEY (class_section_id, class_id, academic_year_id) 
        REFERENCES public.class_sections(id, class_id, academic_year_id),
        
    CONSTRAINT fk_class_schedules_subject 
        FOREIGN KEY (class_subject_id, class_id, academic_year_id) 
        REFERENCES public.class_subjects(id, class_id, academic_year_id),

    -- TEMPORAL COLLISION PREVENTION (THE CORE HEART)
    
    -- 1. Teacher Double-Booking Prevention
    CONSTRAINT uq_timetable_teacher_no_overlap
    EXCLUDE USING GIST (
        teacher_id WITH =,
        day_of_week WITH =,
        time_slot_id WITH =,
        daterange(valid_from, COALESCE(valid_to, 'infinity')) WITH &&
    ),
    
    -- 2. Section Double-Booking Prevention
    CONSTRAINT uq_timetable_section_no_overlap
    EXCLUDE USING GIST (
        class_section_id WITH =,
        day_of_week WITH =,
        time_slot_id WITH =,
        daterange(valid_from, COALESCE(valid_to, 'infinity')) WITH &&
    ),
    
    -- 3. Room Collision Prevention
    CONSTRAINT uq_timetable_room_no_overlap
    EXCLUDE USING GIST (
        class_room_id WITH =,
        day_of_week WITH =,
        time_slot_id WITH =,
        daterange(valid_from, COALESCE(valid_to, 'infinity')) WITH &&
    )
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_class_schedules_section ON public.class_schedules(class_section_id, academic_year_id);
CREATE INDEX IF NOT EXISTS idx_class_schedules_teacher ON public.class_schedules(teacher_id, academic_year_id);
CREATE INDEX IF NOT EXISTS idx_class_schedules_room ON public.class_schedules(class_room_id, academic_year_id);
CREATE INDEX IF NOT EXISTS idx_class_schedules_lookup ON public.class_schedules(day_of_week, time_slot_id, academic_year_id);

-- 49. Leave Management (Staff Time-Off Ledger)
CREATE TABLE IF NOT EXISTS public.leave_applications (
    id SERIAL PRIMARY KEY,
    applicant_staff_id integer NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    leave_type_id integer NOT NULL REFERENCES public.leave_types(id) ON DELETE RESTRICT,
    valid_period daterange NOT NULL,
    reason text,
    attachment_url character varying(500),
    status character varying(20) DEFAULT 'Pending', -- Pending, Approved, Rejected, Cancelled, Auto-Generated
    approved_by integer REFERENCES public.staff(id),
    approval_date TIMESTAMPTZ,
    rejection_reason text,
    
    remarks text,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by integer,
    updated_by integer,
    
    CONSTRAINT leave_applications_status_check CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Cancelled', 'Auto-Generated'))
);

-- 50. Student Attendance (Temporal Scoped Ledger)
CREATE TABLE IF NOT EXISTS public.student_attendance (
    id SERIAL PRIMARY KEY,
    student_id integer NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    academic_year_id integer NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    class_id integer NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
    class_section_id integer NOT NULL,
    lifecycle_id integer NOT NULL REFERENCES public.student_lifecycle_ledger(id) ON DELETE RESTRICT, -- Temporal Anchor
    attendance_date date NOT NULL,
    status character varying(20) NOT NULL, -- Present, Absent, Late, Half-Day, Holiday, Excused
    
    remarks text,
    marked_by integer REFERENCES public.staff(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by integer,
    updated_by integer,
    
    -- Ensure only one record per student per day
    UNIQUE (student_id, attendance_date),
    
    -- Triple-Key Anchor: Locking record to the correct class and year context
    CONSTRAINT fk_student_attendance_context
        FOREIGN KEY (lifecycle_id, student_id, academic_year_id, class_id) 
        REFERENCES public.student_lifecycle_ledger(id, student_id, to_academic_year_id, to_class_id),
        
    CONSTRAINT student_attendance_status_check CHECK (status IN ('Present', 'Absent', 'Late', 'Half-Day', 'Holiday', 'Excused'))
);

-- 50. Staff Attendance (Unified Workforce Ledger)
CREATE TABLE IF NOT EXISTS public.staff_attendance (
    id SERIAL PRIMARY KEY,
    staff_id integer NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    academic_year_id integer NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    salary_assignment_id integer NOT NULL REFERENCES public.staff_salary_assignments(id) ON DELETE RESTRICT, -- Temporal Anchor
    attendance_date date NOT NULL,
    status character varying(20) NOT NULL, -- Present, Absent, Late, Half-Day, Holiday, On Leave
    leave_application_id integer REFERENCES public.leave_applications(id) ON DELETE SET NULL,
    
    check_in_time time without time zone,
    check_out_time time without time zone,
    
    remarks text,
    marked_by integer REFERENCES public.staff(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by integer,
    updated_by integer,
    
    -- Ensure only one record per staff per day
    UNIQUE (staff_id, attendance_date),
    
    -- Universal Ledger Rule: All lost time must be accounted for in the leave system
    CONSTRAINT chk_staff_attendance_leave_required 
        CHECK (
            (status IN ('Absent', 'Half-Day', 'On Leave') AND leave_application_id IS NOT NULL) OR 
            (status NOT IN ('Absent', 'Half-Day', 'On Leave') AND leave_application_id IS NULL)
        ),
        
    CONSTRAINT staff_attendance_time_check CHECK (check_out_time IS NULL OR check_in_time IS NULL OR check_out_time >= check_in_time),
    CONSTRAINT staff_attendance_status_check CHECK (status IN ('Present', 'Absent', 'Late', 'Half-Day', 'Holiday', 'On Leave'))
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_student_attendance_date ON public.student_attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_student_attendance_context ON public.student_attendance(class_id, academic_year_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_date ON public.staff_attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_year ON public.staff_attendance(academic_year_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_leave_applications_period ON public.leave_applications USING GIST (valid_period);
CREATE INDEX IF NOT EXISTS idx_leave_applications_staff ON public.leave_applications(applicant_staff_id);

-- 51. School Holidays (Audience-Aware Calendar)
CREATE TABLE IF NOT EXISTS public.school_holidays (
    id SERIAL PRIMARY KEY,
    academic_year_id integer NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    holiday_name character varying(200) NOT NULL,
    description text,
    holiday_period daterange NOT NULL,
    holiday_type character varying(32), -- National, Religious, Academic, School, Custom
    
    -- Targeting Logic
    target_audience character varying(20) DEFAULT 'ALL', -- ALL, STUDENTS, STAFF, SPECIFIC_CLASS
    target_class_id integer REFERENCES public.classes(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by integer,
    updated_by integer,
    
    -- Ensure target consistency
    CONSTRAINT chk_holiday_target_consistency CHECK (
        (target_audience = 'SPECIFIC_CLASS' AND target_class_id IS NOT NULL) OR
        (target_audience != 'SPECIFIC_CLASS' AND target_class_id IS NULL)
    ),
    
    -- Temporal Integrity: No overlapping holidays for the same audience/class
    CONSTRAINT uq_holiday_no_overlap
    EXCLUDE USING GIST (
        academic_year_id WITH =,
        target_audience WITH =,
        COALESCE(target_class_id, 0) WITH =,
        holiday_period WITH &&
    ),
    
    CONSTRAINT school_holidays_target_check CHECK (target_audience IN ('ALL', 'STUDENTS', 'STAFF', 'SPECIFIC_CLASS')),
    CONSTRAINT school_holidays_type_check CHECK (holiday_type IN ('National', 'Religious', 'Academic', 'School', 'Custom'))
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_school_holidays_period ON public.school_holidays USING GIST (holiday_period);
CREATE INDEX IF NOT EXISTS idx_school_holidays_year ON public.school_holidays(academic_year_id);

-- 53. Homework (Assignment Master)
CREATE TABLE IF NOT EXISTS public.homework (
    id SERIAL PRIMARY KEY,
    academic_year_id integer NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    class_id integer NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
    class_section_id integer NOT NULL REFERENCES public.class_sections(id) ON DELETE RESTRICT,
    class_subject_id integer NOT NULL REFERENCES public.class_subjects(id) ON DELETE RESTRICT,
    
    -- TEACHER INTEGRITY LOCK
    teacher_id integer NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
    teacher_assignment_id integer NOT NULL,
    
    title character varying(200) NOT NULL,
    description text,
    assign_date date NOT NULL DEFAULT CURRENT_DATE,
    due_date date NOT NULL,
    
    -- Teacher Policies
    resubmission_allowed boolean DEFAULT true,
    max_attempts integer DEFAULT 1,
    
    max_marks numeric(5,2) DEFAULT 0.00,
    attachment_url character varying(500),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by integer,
    updated_by integer,
    
    CONSTRAINT chk_homework_dates CHECK (due_date >= assign_date),
    
    -- TRIPLE-KEY CONTEXT LOCK (Ensures the homework exists within a valid class/section/subject context)
    CONSTRAINT fk_homework_class_section 
        FOREIGN KEY (class_section_id, class_id, academic_year_id) 
        REFERENCES public.class_sections(id, class_id, academic_year_id),
        
    CONSTRAINT fk_homework_class_subject
        FOREIGN KEY (class_subject_id, class_id, academic_year_id) 
        REFERENCES public.class_subjects(id, class_id, academic_year_id),
        
    CONSTRAINT fk_homework_teacher_assignment
        FOREIGN KEY (teacher_assignment_id, teacher_id, class_section_id, class_subject_id, academic_year_id)
        REFERENCES public.subject_teacher_assignments (id, staff_id, class_section_id, class_subject_id, academic_year_id),
        
    -- ULTIMATE INTEGRITY ANCHOR (Used for locking submissions to the same class/year context)
    CONSTRAINT uq_homework_anchor UNIQUE (id, class_id, academic_year_id)
);



-- 54. Homework Submissions (Student Ledger)
CREATE TABLE IF NOT EXISTS public.homework_submissions (
    id SERIAL PRIMARY KEY,
    homework_id integer NOT NULL,
    student_id integer NOT NULL,
    student_lifecycle_id integer NOT NULL,
    
    -- Contextual Keys (Passed down for integrity locking)
    academic_year_id integer NOT NULL,
    class_id integer NOT NULL,
    
    attempt_number integer DEFAULT 1,
    
    submission_date TIMESTAMPTZ DEFAULT NOW(),
    submission_text text,
    attachment_url character varying(500),
    status character varying(20) DEFAULT 'Submitted', -- Submitted, Late, Evaluated, Resubmission Requested
    
    marks_obtained numeric(5,2),
    teacher_feedback text,
    evaluated_by integer REFERENCES public.staff(id),
    evaluation_date TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by integer,
    updated_by integer,
    
    -- Ensure one record per student per assignment attempt
    UNIQUE (homework_id, student_id, attempt_number),
    
    CONSTRAINT homework_submissions_status_check 
        CHECK (status IN ('Submitted', 'Late', 'Evaluated', 'Resubmission Requested')),
        
    -- ULTIMATE INTEGRITY LOCK: Submission MUST match the Homework's Class/Year context
    CONSTRAINT fk_submission_homework_context
        FOREIGN KEY (homework_id, class_id, academic_year_id)
        REFERENCES public.homework (id, class_id, academic_year_id),
        
    -- ULTIMATE INTEGRITY LOCK: Submission MUST match the Student's active Lifecycle context
    CONSTRAINT fk_homework_submission_lifecycle
        FOREIGN KEY (student_lifecycle_id, student_id, academic_year_id, class_id)
        REFERENCES public.student_lifecycle_ledger (id, student_id, to_academic_year_id, to_class_id)
);


-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_homework_context ON public.homework(class_section_id, class_subject_id, academic_year_id);
CREATE INDEX IF NOT EXISTS idx_homework_due_date ON public.homework(due_date);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_student ON public.homework_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_homework ON public.homework_submissions(homework_id);

-- 55. Admission Enquiries (Lead Master)
CREATE TABLE IF NOT EXISTS public.admission_enquiries (
    id SERIAL PRIMARY KEY,
    academic_year_id integer NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    enquiry_date date NOT NULL DEFAULT CURRENT_DATE,
    enquiry_type character varying(30), -- Admission, Transfer, General, Other
    
    student_name character varying(200) NOT NULL,
    gender character varying(10),
    date_of_birth date,
    
    parent_name character varying(200),
    mobile_number character varying(20) NOT NULL,
    email character varying(254),
    address text,
    previous_school character varying(200),
    target_class_id integer REFERENCES public.classes(id) ON DELETE RESTRICT,
    
    source character varying(50), -- Website, Walk-in, Social Media, Referral
    status character varying(20) DEFAULT 'Open', -- Open, In Progress, Converted, Lost
    description text,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by integer,
    updated_by integer,
    
    CONSTRAINT admission_enquiries_status_check CHECK (status IN ('Open', 'In Progress', 'Converted', 'Lost')),
    CONSTRAINT admission_enquiries_gender_check CHECK (gender IN ('Male', 'Female', 'Other'))
);

-- 56. Enquiry Follow-ups (Interaction Ledger)
CREATE TABLE IF NOT EXISTS public.enquiry_follow_ups (
    id SERIAL PRIMARY KEY,
    enquiry_id integer NOT NULL REFERENCES public.admission_enquiries(id) ON DELETE CASCADE,
    follow_up_date TIMESTAMPTZ DEFAULT NOW(),
    remarks text NOT NULL,
    next_follow_up_date date,
    counselor_id integer REFERENCES public.staff(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by integer,
    updated_by integer,
    
    CONSTRAINT chk_follow_up_future CHECK (next_follow_up_date >= follow_up_date::date)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_enquiries_mobile ON public.admission_enquiries(mobile_number);
CREATE INDEX IF NOT EXISTS idx_enquiries_academic_year ON public.admission_enquiries(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_status ON public.admission_enquiries(status);
CREATE INDEX IF NOT EXISTS idx_enquiry_follow_ups_parent ON public.enquiry_follow_ups(enquiry_id);
CREATE INDEX IF NOT EXISTS idx_enquiry_follow_ups_date ON public.enquiry_follow_ups(follow_up_date);

-- 57. School Profile (Identity & Branding)
CREATE TABLE IF NOT EXISTS public.school_profile (
    id SERIAL PRIMARY KEY,
    school_name character varying(255) NOT NULL,
    logo_url text,
    phone character varying(30),
    email character varying(254),
    fax character varying(30),
    address text,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- 59. Library Books (Bibliographic Master)
CREATE TABLE IF NOT EXISTS public.library_books (
    id SERIAL PRIMARY KEY,
    category_id integer REFERENCES public.library_categories(id) ON DELETE SET NULL,
    book_title character varying(255) NOT NULL,
    author character varying(255),
    edition character varying(50),
    language character varying(50) DEFAULT 'English',
    isbn character varying(20),
    publisher character varying(255),
    publication_year integer,
    book_price numeric(10,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_library_book_isbn 
ON public.library_books (isbn) 
WHERE (deleted_at IS NULL AND isbn IS NOT NULL);


-- 60. Library Book Copies (Physical Asset Ledger)
CREATE TABLE IF NOT EXISTS public.library_book_copies (
    id SERIAL PRIMARY KEY,
    book_id integer NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
    accession_number character varying(50) NOT NULL,
    book_location character varying(100), -- Shelf/Rack info
    condition character varying(20) DEFAULT 'New', -- New, Good, Damaged, Lost, Maintenance
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_book_accession_number 
ON public.library_book_copies (accession_number) 
WHERE (deleted_at IS NULL);

ALTER TABLE public.library_book_copies 
ADD CONSTRAINT chk_book_copy_condition 
CHECK (condition IN ('New', 'Good', 'Damaged', 'Lost', 'Maintenance'));


-- 62. Library Policies (Rule Engine)
CREATE TABLE IF NOT EXISTS public.library_policies (
    id SERIAL PRIMARY KEY,
    policy_name character varying(100) NOT NULL,
    audience_type character varying(20) DEFAULT 'ALL', -- Student, Staff, ALL
    
    max_books_allowed integer DEFAULT 1,
    issue_duration_days integer NOT NULL,
    max_renewals_allowed integer DEFAULT 0,
    per_day_fine numeric(6,2) DEFAULT 0.00,
    grace_period_days integer DEFAULT 0,
    max_fine_limit numeric(8,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    CONSTRAINT chk_library_policy_audience CHECK (audience_type IN ('Student', 'Staff', 'ALL'))
);

-- 61. Library Book Issues (Circulation Ledger)
CREATE TABLE IF NOT EXISTS public.library_book_issues (
    id SERIAL PRIMARY KEY,
    academic_year_id integer NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    book_copy_id integer NOT NULL REFERENCES public.library_book_copies(id) ON DELETE RESTRICT,
    policy_id integer REFERENCES public.library_policies(id) ON DELETE RESTRICT,
    
    -- BORROWER XOR (Student OR Staff)
    student_id integer REFERENCES public.students(id) ON DELETE RESTRICT,
    staff_id integer REFERENCES public.staff(id) ON DELETE RESTRICT,
    student_lifecycle_id integer, -- Anchors students to their specific enrollment period
    
    issue_date date NOT NULL DEFAULT CURRENT_DATE,
    due_date date NOT NULL,
    return_date date,
    
    -- Asset History (Condition tracking)
    condition_on_issue character varying(20) DEFAULT 'Good',
    condition_on_return character varying(20),
    renewal_count integer DEFAULT 0,
    
    fine_amount numeric(8,2) DEFAULT 0.00,
    status character varying(20) DEFAULT 'Issued', -- Issued, Returned, Lost, Damaged
    
    issued_by integer REFERENCES public.staff(id) ON DELETE SET NULL,
    returned_to integer REFERENCES public.staff(id) ON DELETE SET NULL,
    remarks text,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    CONSTRAINT chk_library_borrower_xor CHECK (
        (student_id IS NOT NULL AND staff_id IS NULL) OR 
        (student_id IS NULL AND staff_id IS NOT NULL)
    ),
    CONSTRAINT chk_library_issue_dates CHECK (due_date >= issue_date),
    CONSTRAINT chk_library_issue_status CHECK (status IN ('Issued', 'Returned', 'Lost', 'Damaged')),
    
    -- ULTIMATE HISTORY LOCK: Ensures the student was active during that academic year
    CONSTRAINT fk_library_issue_student_lifecycle
        FOREIGN KEY (student_lifecycle_id, student_id, academic_year_id)
        REFERENCES public.student_lifecycle_ledger (id, student_id, to_academic_year_id)
);


-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_library_books_category ON public.library_books(category_id);
CREATE INDEX IF NOT EXISTS idx_library_books_isbn ON public.library_books(isbn);
CREATE INDEX IF NOT EXISTS idx_library_copies_book ON public.library_book_copies(book_id);
CREATE INDEX IF NOT EXISTS idx_library_copies_accession ON public.library_book_copies(accession_number);
CREATE INDEX IF NOT EXISTS idx_library_issues_book_copy ON public.library_book_issues(book_copy_id);
CREATE INDEX IF NOT EXISTS idx_library_issues_student ON public.library_book_issues(student_id);
CREATE INDEX IF NOT EXISTS idx_library_issues_staff ON public.library_book_issues(staff_id);
CREATE INDEX IF NOT EXISTS idx_library_issues_status ON public.library_book_issues(status);
CREATE INDEX IF NOT EXISTS idx_library_issues_academic_year ON public.library_book_issues(academic_year_id);

-- ULTIMATE ASSET LOCK: A physical copy can only be issued once at a time
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_issue_per_copy 
ON public.library_book_issues (book_copy_id) 
WHERE (status = 'Issued' AND deleted_at IS NULL);

-- 63. Library Book Reservations (Queue Management)
CREATE TABLE IF NOT EXISTS public.library_book_reservations (
    id SERIAL PRIMARY KEY,
    academic_year_id integer NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    book_id integer NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
    
    -- BORROWER XOR (Student OR Staff)
    student_id integer REFERENCES public.students(id) ON DELETE RESTRICT,
    staff_id integer REFERENCES public.staff(id) ON DELETE RESTRICT,
    student_lifecycle_id integer, -- Anchors students to their specific enrollment period
    
    reserved_at TIMESTAMPTZ DEFAULT NOW(),
    expiration_date date,
    status character varying(20) DEFAULT 'Pending', -- Pending, Fulfilled, Cancelled, Expired
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    CONSTRAINT chk_library_res_borrower_xor CHECK (
        (student_id IS NOT NULL AND staff_id IS NULL) OR 
        (student_id IS NULL AND staff_id IS NOT NULL)
    ),
    CONSTRAINT chk_library_res_status CHECK (status IN ('Pending', 'Fulfilled', 'Cancelled', 'Expired')),
    
    -- ULTIMATE HISTORY LOCK: Ensures the student is active during the reservation year
    CONSTRAINT fk_library_res_student_lifecycle
        FOREIGN KEY (student_lifecycle_id, student_id, academic_year_id)
        REFERENCES public.student_lifecycle_ledger (id, student_id, to_academic_year_id)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_library_res_book ON public.library_book_reservations(book_id);
CREATE INDEX IF NOT EXISTS idx_library_res_student ON public.library_book_reservations(student_id);
CREATE INDEX IF NOT EXISTS idx_library_res_status ON public.library_book_reservations(status);
CREATE INDEX IF NOT EXISTS idx_library_res_date ON public.library_book_reservations(reserved_at);

-- 64. Routes (Geographic Master)
CREATE TABLE IF NOT EXISTS public.routes (
    id SERIAL PRIMARY KEY,
    route_name character varying(100) NOT NULL,
    route_code character varying(20),
    start_point character varying(200),
    end_point character varying(200),
    total_distance numeric(8,2),
    estimated_time integer, -- Minutes
    description text,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_route_name ON public.routes (route_name) WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX IF NOT EXISTS uq_route_code ON public.routes (route_code) WHERE (deleted_at IS NULL AND route_code IS NOT NULL);

-- 65. Pickup Points (The Stop Ledger)
CREATE TABLE IF NOT EXISTS public.pickup_points (
    id SERIAL PRIMARY KEY,
    route_id integer NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
    point_name character varying(100) NOT NULL,
    address text,
    landmark character varying(200),
    pickup_time time,
    drop_time time,
    distance_from_school numeric(8,2),
    sequence_order integer NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    -- Ensuring stop context for later locks
    CONSTRAINT uq_stop_per_route UNIQUE (id, route_id)
);

-- 66. Transport Vehicles (The Fleet Master)
CREATE TABLE IF NOT EXISTS public.transport_vehicles (
    id SERIAL PRIMARY KEY,
    vehicle_number character varying(20) NOT NULL, -- License Plate
    vehicle_type character varying(20), -- Bus, Van, Car
    brand character varying(50),
    model character varying(50),
    seating_capacity integer,
    
    insurance_expiry date,
    fitness_expiry date,
    permit_expiry date,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    CONSTRAINT chk_vehicle_type CHECK (vehicle_type IN ('Bus', 'Van', 'Car'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicle_number ON public.transport_vehicles (vehicle_number) WHERE (deleted_at IS NULL);

-- 68. Vehicle Route Assignments (Fleet Operational Anchor)
CREATE TABLE IF NOT EXISTS public.vehicle_route_assignments (
    id SERIAL PRIMARY KEY,
    academic_year_id integer NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    route_id integer NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
    vehicle_id integer NOT NULL REFERENCES public.transport_vehicles(id) ON DELETE CASCADE,
    staff_id integer NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT, -- The Driver
    
    valid_period daterange NOT NULL, -- The "Temporal Validity" lock
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    -- ULTIMATE FLEET LOCKS:
    -- 1. A physical bus cannot be on two different routes at once
    CONSTRAINT uq_vehicle_no_overlap
    EXCLUDE USING GIST (vehicle_id WITH =, academic_year_id WITH =, valid_period WITH &&) WHERE (deleted_at IS NULL),
    
    -- 2. A driver cannot drive two different buses at once
    CONSTRAINT uq_driver_no_overlap
    EXCLUDE USING GIST (staff_id WITH =, academic_year_id WITH =, valid_period WITH &&) WHERE (deleted_at IS NULL)
);

-- 69. Transport Fee Master (The Pricing Ledger)
CREATE TABLE IF NOT EXISTS public.transport_fee_master (
    id SERIAL PRIMARY KEY,
    academic_year_id integer NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    pickup_point_id integer REFERENCES public.pickup_points(id) ON DELETE CASCADE,
    plan_name character varying(100) NOT NULL,
    student_amount numeric(12,2) NOT NULL DEFAULT 0.00,
    staff_amount numeric(12,2) NOT NULL DEFAULT 0.00,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_transport_fee_plan 
ON public.transport_fee_master (academic_year_id, pickup_point_id, plan_name) 
WHERE (deleted_at IS NULL);

-- 70. Transport Allocations (The Commute & Billing Ledger)
CREATE TABLE IF NOT EXISTS public.transport_allocations (
    id SERIAL PRIMARY KEY,
    academic_year_id integer NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    
    -- BORROWER XOR (Student OR Staff)
    student_id integer REFERENCES public.students(id) ON DELETE RESTRICT,
    staff_id integer REFERENCES public.staff(id) ON DELETE RESTRICT,
    student_lifecycle_id integer, -- The academic anchor for students
    
    route_id integer NOT NULL REFERENCES public.routes(id) ON DELETE RESTRICT,
    pickup_point_id integer NOT NULL REFERENCES public.pickup_points(id) ON DELETE RESTRICT,
    vehicle_id integer REFERENCES public.transport_vehicles(id) ON DELETE SET NULL,
    fee_master_id integer REFERENCES public.transport_fee_master(id) ON DELETE SET NULL,
    
    assigned_amount numeric(12,2) NOT NULL DEFAULT 0.00,
    is_free boolean DEFAULT false,
    
    start_date date NOT NULL DEFAULT CURRENT_DATE,
    end_date date,
    status character varying(20) DEFAULT 'Active', -- Active, Inactive, Completed
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    CONSTRAINT chk_transport_borrower_xor CHECK (
        (student_id IS NOT NULL AND staff_id IS NULL) OR 
        (student_id IS NULL AND staff_id IS NOT NULL)
    ),
    CONSTRAINT chk_transport_dates CHECK (end_date IS NULL OR end_date >= start_date),
    
    -- ULTIMATE CONTEXT LOCK: A student cannot be assigned a stop that doesn't belong to the route
    CONSTRAINT fk_transport_stop_context
    FOREIGN KEY (pickup_point_id, route_id)
    REFERENCES public.pickup_points (id, route_id),
    
    -- LIFECYCLE LOCK: Anchors student transport to their active session enrollment
    CONSTRAINT fk_transport_student_lifecycle
    FOREIGN KEY (student_lifecycle_id, student_id, academic_year_id)
    REFERENCES public.student_lifecycle_ledger (id, student_id, to_academic_year_id)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_transport_alloc_student ON public.transport_allocations(student_id);
CREATE INDEX IF NOT EXISTS idx_transport_alloc_route ON public.transport_allocations(route_id);
CREATE INDEX IF NOT EXISTS idx_transport_alloc_status ON public.transport_allocations(status);
CREATE INDEX IF NOT EXISTS idx_transport_fee_point ON public.transport_fee_master(pickup_point_id);

-- SINGLETON ACTIVE COMMUTE: A student can only have one active transport assignment at a time
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_transport_per_student
ON public.transport_allocations (student_lifecycle_id)
WHERE (status = 'Active' AND deleted_at IS NULL);
-- 71. Account Categories (Chart of Accounts Master)
CREATE TABLE IF NOT EXISTS public.account_categories (
    id SERIAL PRIMARY KEY,
    academic_year_id integer REFERENCES public.academic_years(id) ON DELETE SET NULL,
    category_name character varying(255) NOT NULL,
    category_type character varying(20) NOT NULL, -- Income, Expense
    description text,
    is_active boolean DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    CONSTRAINT chk_account_category_type CHECK (category_type IN ('Income', 'Expense'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_account_category_name 
ON public.account_categories (academic_year_id, category_type, category_name) 
WHERE (deleted_at IS NULL);

-- 72. Financial Ledger (The Universal Transaction Log)
CREATE TABLE IF NOT EXISTS public.financial_ledger (
    id SERIAL PRIMARY KEY,
    academic_year_id integer NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    category_id integer REFERENCES public.account_categories(id) ON DELETE SET NULL,
    
    title character varying(255) NOT NULL,
    description text,
    transaction_date date NOT NULL DEFAULT CURRENT_DATE,
    amount numeric(14,2) NOT NULL,
    transaction_type character varying(20) NOT NULL, -- Income, Expense
    
    payment_mode character varying(64), -- Cash, UPI, Card, Bank Transfer
    invoice_no character varying(64), -- External reference
    voucher_no character varying(64), -- Internal audit reference
    source_reference character varying(255), -- e.g., "Vendor: Amazon", "Donor: John"
    
    status character varying(32) DEFAULT 'Completed', -- Completed, Pending
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    CONSTRAINT chk_ledger_amount_positive CHECK (amount > 0),
    CONSTRAINT chk_ledger_type CHECK (transaction_type IN ('Income', 'Expense'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_voucher 
ON public.financial_ledger (voucher_no) 
WHERE (deleted_at IS NULL AND voucher_no IS NOT NULL);

-- 73. Accounts Invoices (The Billing Master)
CREATE TABLE IF NOT EXISTS public.accounts_invoices (
    id SERIAL PRIMARY KEY,
    academic_year_id integer NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    
    invoice_number character varying(64) NOT NULL,
    invoice_date date NOT NULL DEFAULT CURRENT_DATE,
    due_date date NOT NULL,
    amount numeric(14,2) NOT NULL,
    
    payment_mode character varying(64),
    status character varying(32) DEFAULT 'Pending', -- Pending, Paid, Partial, Cancelled
    description text,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    CONSTRAINT chk_invoice_amount_positive CHECK (amount > 0),
    CONSTRAINT chk_invoice_dates CHECK (due_date >= invoice_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_session_number 
ON public.accounts_invoices (academic_year_id, invoice_number) 
WHERE (deleted_at IS NULL);

-- Performance Indexes for Accounting
CREATE INDEX IF NOT EXISTS idx_ledger_date ON public.financial_ledger(transaction_date);
CREATE INDEX IF NOT EXISTS idx_ledger_year ON public.financial_ledger(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_ledger_type ON public.financial_ledger(transaction_type);
CREATE INDEX IF NOT EXISTS idx_invoice_year ON public.accounts_invoices(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_invoice_status ON public.accounts_invoices(status);

-- 74. Blocked Users (Privacy Layer)
CREATE TABLE IF NOT EXISTS public.blocked_users (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    blocked_user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE (user_id, blocked_user_id)
);

-- 75. Calls (Communication Log)
CREATE TABLE IF NOT EXISTS public.calls (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    recipient_id integer REFERENCES public.users(id) ON DELETE SET NULL,
    call_type character varying(20) NOT NULL, -- Audio, Video, etc.
    phone_number character varying(20),
    duration integer DEFAULT 0,
    call_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 76. Chat Settings (User Preferences)
CREATE TABLE IF NOT EXISTS public.chat_settings (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    recipient_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    is_muted boolean DEFAULT false,
    muted_until TIMESTAMPTZ,
    cleared_at TIMESTAMPTZ,
    disappearing_seconds integer,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE (user_id, recipient_id)
);

-- 77. Chats (Messaging Ledger)
CREATE TABLE IF NOT EXISTS public.chats (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    recipient_id integer REFERENCES public.users(id) ON DELETE CASCADE,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    is_pinned boolean DEFAULT false,
    message_type character varying(20) DEFAULT 'text',
    file_url text,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 78. Emails (Professional Communication Log)
CREATE TABLE IF NOT EXISTS public.emails (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    sender_id integer REFERENCES public.users(id) ON DELETE SET NULL,
    sender_email character varying(255),
    recipient_email character varying(255),
    subject character varying(500) NOT NULL,
    body text NOT NULL,
    is_read boolean DEFAULT false,
    is_starred boolean DEFAULT false,
    is_important boolean DEFAULT false,
    folder character varying(50) DEFAULT 'inbox',
    has_attachment boolean DEFAULT false,
    attachment_url text,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 79. Notes (User Productivity)
CREATE TABLE IF NOT EXISTS public.notes (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    tag character varying(50),
    priority character varying(20) DEFAULT 'medium',
    is_important boolean DEFAULT false,
    is_deleted boolean DEFAULT false, -- Legacy flag
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 80. Todos (Task Management)
CREATE TABLE IF NOT EXISTS public.todos (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title character varying(255) NOT NULL,
    description text,
    due_date TIMESTAMPTZ,
    priority character varying(20) DEFAULT 'medium',
    status character varying(20) DEFAULT 'pending',
    tag character varying(50),
    is_important boolean DEFAULT false,
    assigned_to integer REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Optimized Performance Indexes
CREATE INDEX IF NOT EXISTS idx_chats_user_recipient ON public.chats(user_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_chats_created_at ON public.chats(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_user ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_user_status ON public.todos(user_id, status);
CREATE INDEX IF NOT EXISTS idx_emails_recipient ON public.emails(recipient_email);
CREATE INDEX IF NOT EXISTS idx_calls_user ON public.calls(user_id);


-- 82. Documents (Student & Staff Records)
CREATE TABLE IF NOT EXISTS public.documents (
    id SERIAL PRIMARY KEY,
    document_type_id integer REFERENCES public.document_types(id) ON DELETE SET NULL,
    student_id integer REFERENCES public.students(id) ON DELETE CASCADE,
    staff_id integer REFERENCES public.staff(id) ON DELETE CASCADE,
    document_name character varying(200) NOT NULL,
    file_path character varying(500),
    file_size integer,
    upload_date date DEFAULT CURRENT_DATE,
    expiry_date date,
    is_verified boolean DEFAULT false,
    verified_by integer REFERENCES public.users(id) ON DELETE SET NULL,
    verified_date date,
    remarks text,
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by integer REFERENCES public.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 83. Files (Media & Folder Management)
CREATE TABLE IF NOT EXISTS public.files (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name character varying(255) NOT NULL,
    file_type character varying(50),
    mime_type character varying(100),
    size bigint DEFAULT 0,
    file_url text,
    parent_folder_id integer REFERENCES public.files(id) ON DELETE CASCADE,
    is_folder boolean DEFAULT false,
    is_shared boolean DEFAULT false,
    shared_with integer[], -- Array of user IDs
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Performance Indexes for Documents
CREATE INDEX IF NOT EXISTS idx_documents_student ON public.documents(student_id);
CREATE INDEX IF NOT EXISTS idx_documents_staff ON public.documents(staff_id);
CREATE INDEX IF NOT EXISTS idx_files_user ON public.files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_parent ON public.files(parent_folder_id);

-- 84. Calendar Events (Personal & Shared Schedules)
CREATE TABLE IF NOT EXISTS public.calendar_events (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title character varying(255) NOT NULL,
    description text,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,
    event_color character varying(20) DEFAULT 'bg-primary',
    is_all_day boolean DEFAULT false,
    location character varying(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 85. School Events (Institutional Targeting)
CREATE TABLE IF NOT EXISTS public.events (
    id SERIAL PRIMARY KEY,
    title character varying(255) NOT NULL,
    description text,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,
    event_color character varying(50) DEFAULT 'bg-primary',
    is_all_day boolean DEFAULT false,
    location character varying(255),
    event_category character varying(50),
    event_for character varying(20) DEFAULT 'all', -- all, student, staff
    target_class_ids jsonb, -- Array of class IDs
    target_section_ids jsonb, -- Array of section IDs
    attachment_url text,
    created_by integer REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 86. Notice Board (Central Announcements)
CREATE TABLE IF NOT EXISTS public.notice_board (
    id SERIAL PRIMARY KEY,
    title character varying(255) NOT NULL,
    content text,
    message_to character varying(100) DEFAULT 'All', -- All, Staff, Student
    created_by integer REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Performance Indexes for Communication
CREATE INDEX IF NOT EXISTS idx_notice_board_created_at ON public.notice_board(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_period ON public.events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_calendar_user ON public.calendar_events(user_id, start_date);

-- 87. Account Delete Requests (Privacy Layer)
CREATE TABLE IF NOT EXISTS public.account_delete_requests (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    requisition_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delete_request_date TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    reason TEXT,
    requested_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    reviewed_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_delete_request_status CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled'))
);

-- 89. Global Settings (Configuration Layer)
CREATE TABLE IF NOT EXISTS public.settings (
    id SERIAL PRIMARY KEY,
    setting_key character varying(255) NOT NULL,
    setting_value text,
    setting_group character varying(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT uq_setting_key UNIQUE (setting_key)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_delete_requests_status ON public.account_delete_requests(status);
CREATE INDEX IF NOT EXISTS idx_class_rooms_building ON public.class_rooms(building_name, floor);
CREATE INDEX IF NOT EXISTS idx_settings_group ON public.settings(setting_group);



-- 92. Reports (User-Reported Incidents)
CREATE TABLE IF NOT EXISTS public.reports (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reported_user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reason text,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 93. Event Attachments (Media Bridge)
CREATE TABLE IF NOT EXISTS public.event_attachments (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(120),
    file_size BIGINT,
    uploaded_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- Final Performance Indexes
CREATE INDEX IF NOT EXISTS idx_reports_users ON public.reports(user_id, reported_user_id);
CREATE INDEX IF NOT EXISTS idx_event_attachments_event ON public.event_attachments(event_id);
CREATE INDEX IF NOT EXISTS idx_leave_types_active ON public.leave_types(is_active);


-- 96. Library Members (Identity Bridge)
CREATE TABLE IF NOT EXISTS public.library_members (
    id SERIAL PRIMARY KEY,
    card_number character varying(50) NOT NULL UNIQUE,
    student_id integer REFERENCES public.students(id) ON DELETE CASCADE,
    staff_id integer REFERENCES public.staff(id) ON DELETE CASCADE,
    academic_year_id integer NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    status character varying(20) DEFAULT 'active', -- active, suspended, expired
    remarks text,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- XOR Constraint: Must be either a student or a staff, not both/neither
    CONSTRAINT library_member_identity_check CHECK (
        (student_id IS NOT NULL AND staff_id IS NULL) OR 
        (student_id IS NULL AND staff_id IS NOT NULL)
    ),
    
    -- Ensure only one library identity per person per session
    CONSTRAINT uq_member_session_student UNIQUE (student_id, academic_year_id),
    CONSTRAINT uq_member_session_staff UNIQUE (staff_id, academic_year_id)
);

-- Final Performance Indexes
CREATE INDEX IF NOT EXISTS idx_library_members_card ON public.library_members(card_number);
CREATE INDEX IF NOT EXISTS idx_library_members_year ON public.library_members(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_languages_compulsory ON public.languages(is_compulsory);






