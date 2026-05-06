-- Scope elective groups to specific classes
ALTER TABLE subject_elective_groups ADD COLUMN IF NOT EXISTS class_id INTEGER REFERENCES classes(id);

-- Optional: Add index for performance
CREATE INDEX IF NOT EXISTS idx_subject_elective_groups_class_id ON subject_elective_groups(class_id);
