-- Add elective groups table and link it to class_subjects
CREATE TABLE IF NOT EXISTS subject_elective_groups (
    id SERIAL PRIMARY KEY,
    group_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by INTEGER,
    updated_by INTEGER
);

-- Add elective_group_id to class_subjects
ALTER TABLE class_subjects ADD COLUMN IF NOT EXISTS elective_group_id INTEGER REFERENCES subject_elective_groups(id);

-- Add unique constraint to prevent duplicate subjects in the same group for the same class/year
-- (Optional: depends if we want a subject to be in multiple groups, usually no)
