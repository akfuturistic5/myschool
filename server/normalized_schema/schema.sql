-- Normalized Schema Definitions (Ultimate Integrity Version)
-- Enforces absolute logical correctness via Triple-Key Composite Foreign Keys.

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
    updated_by INTEGER,
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

-- 10. Fee Types (Global Master)
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
    CONSTRAINT uq_fee_anchor UNIQUE (id, class_id, academic_year_id),
    CONSTRAINT uq_one_fee_per_class_year UNIQUE (class_id, academic_year_id) WHERE deleted_at IS NULL
);

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
    
    -- Uniqueness constraint: One payslip per staff per period (excluding cancelled)
    CONSTRAINT uq_staff_payslip_period UNIQUE (staff_id, salary_period) 
    WHERE (status != 'Cancelled'),
    
    CONSTRAINT staff_payslip_status_check CHECK (status IN ('Draft', 'Generated', 'Paid', 'Cancelled'))
);

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
    
    CONSTRAINT ledger_event_type_check CHECK (event_type IN ('ADMISSION', 'PROMOTE', 'DETAIN', 'LEAVE', 'REJOIN', 'TRANSFER'))
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
    room_type character varying(50), -- Classroom, Lab, Hall, etc.
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

-- 48. Leave Types (Policy Master)
CREATE TABLE IF NOT EXISTS public.leave_types (
    id SERIAL PRIMARY KEY,
    type_name character varying(50) NOT NULL UNIQUE,
    code character varying(10) UNIQUE,
    description text,
    is_paid boolean DEFAULT true,
    max_days_per_year integer,
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by integer,
    updated_by integer
);

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
        FOREIGN KEY (student_id, class_id, academic_year_id) 
        REFERENCES public.students(id, class_id, academic_year_id),
        
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
