-- =====================================================
-- Leave Types and Leave Applications Tables
-- =====================================================

-- leave_types: types of leave (Medical, Casual, etc.)
CREATE TABLE IF NOT EXISTS leave_types (
    id SERIAL PRIMARY KEY,
    leave_type VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    max_days_per_year INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- leave_applications: applications submitted by students or staff
CREATE TABLE IF NOT EXISTS leave_applications (
    id SERIAL PRIMARY KEY,
    leave_type_id INTEGER NOT NULL REFERENCES leave_types(id) ON DELETE RESTRICT,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    no_of_days INTEGER,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'Pending', -- Pending, Approved, Declined, Rejected
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    reviewed_by INTEGER REFERENCES users(id),
    remarks TEXT,
    CONSTRAINT chk_leave_applicant CHECK (
        (student_id IS NOT NULL AND staff_id IS NULL) OR
        (student_id IS NULL AND staff_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_leave_applications_student_id ON leave_applications(student_id);
CREATE INDEX IF NOT EXISTS idx_leave_applications_staff_id ON leave_applications(staff_id);
CREATE INDEX IF NOT EXISTS idx_leave_applications_leave_type_id ON leave_applications(leave_type_id);
CREATE INDEX IF NOT EXISTS idx_leave_applications_start_date ON leave_applications(start_date DESC);
CREATE INDEX IF NOT EXISTS idx_leave_applications_status ON leave_applications(status);

-- Seed leave types if table is empty
INSERT INTO leave_types (leave_type, description, max_days_per_year) VALUES
    ('Medical Leave', 'Leave for medical reasons', 10),
    ('Casual Leave', 'Casual leave', 12),
    ('Special Leave', 'Special leave', 5),
    ('Maternity Leave', 'Maternity leave', 90),
    ('Paternity Leave', 'Paternity leave', 15),
    ('Emergency Leave', 'Emergency situations', 5)
ON CONFLICT (leave_type) DO NOTHING;
