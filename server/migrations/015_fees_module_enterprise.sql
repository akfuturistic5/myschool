-- =============================================================================
-- ENHANCED FEES MODULE (ENTERPRISE STRUCTURE)
-- =============================================================================

-- 1. Fees Groups (Academic Year Based)
CREATE TABLE IF NOT EXISTS fees_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    academic_year_id INT NOT NULL REFERENCES academic_years(id),
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Fees Types
CREATE TABLE IF NOT EXISTS fees_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Fees Master (Mapping Group + Type + Amount)
CREATE TABLE IF NOT EXISTS fees_master (
    id SERIAL PRIMARY KEY,
    fees_group_id INT NOT NULL REFERENCES fees_groups(id) ON DELETE CASCADE,
    fees_type_id INT NOT NULL REFERENCES fees_types(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    academic_year_id INT NOT NULL REFERENCES academic_years(id),
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(fees_group_id, fees_type_id, academic_year_id)
);

-- 4. Fees Assign (Student Assignment)
CREATE TABLE IF NOT EXISTS fees_assign (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id INT NOT NULL REFERENCES classes(id),
    fees_group_id INT NOT NULL REFERENCES fees_groups(id),
    academic_year_id INT NOT NULL REFERENCES academic_years(id),
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, academic_year_id)
);

-- 5. Fees Assign Details (Snapshot)
CREATE TABLE IF NOT EXISTS fees_assign_details (
    id SERIAL PRIMARY KEY,
    fees_assign_id INT NOT NULL REFERENCES fees_assign(id) ON DELETE CASCADE,
    fees_master_id INT NOT NULL REFERENCES fees_master(id),
    amount NUMERIC(15, 2) NOT NULL, -- Snapshot at time of assignment
    academic_year_id INT NOT NULL REFERENCES academic_years(id),
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Fees Collect (Header)
CREATE TABLE IF NOT EXISTS fees_collect (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    total_paid NUMERIC(15, 2) NOT NULL DEFAULT 0,
    receipt_no VARCHAR(50) NOT NULL UNIQUE,
    academic_year_id INT NOT NULL REFERENCES academic_years(id),
    payment_date DATE DEFAULT CURRENT_DATE,
    payment_mode VARCHAR(20) DEFAULT 'Cash',
    remarks TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Fees Collect Details (Lines)
CREATE TABLE IF NOT EXISTS fees_collect_details (
    id SERIAL PRIMARY KEY,
    fees_collect_id INT NOT NULL REFERENCES fees_collect(id) ON DELETE CASCADE,
    fees_assign_details_id INT NOT NULL REFERENCES fees_assign_details(id),
    paid_amount NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_fees_groups_ay ON fees_groups(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_fees_master_group ON fees_master(fees_group_id);
CREATE INDEX IF NOT EXISTS idx_fees_master_ay ON fees_master(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_fees_assign_student ON fees_assign(student_id);
CREATE INDEX IF NOT EXISTS idx_fees_assign_ay ON fees_assign(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_fees_assign_details_assign ON fees_assign_details(fees_assign_id);
CREATE INDEX IF NOT EXISTS idx_fees_collect_student ON fees_collect(student_id);
CREATE INDEX IF NOT EXISTS idx_fees_collect_ay ON fees_collect(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_fees_collect_details_header ON fees_collect_details(fees_collect_id);
CREATE INDEX IF NOT EXISTS idx_fees_collect_details_assign ON fees_collect_details(fees_assign_details_id);
