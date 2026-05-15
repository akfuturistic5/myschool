ALTER TABLE subject_elective_groups 
ADD COLUMN IF NOT EXISTS max_subjects INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS selectable_subjects INTEGER DEFAULT 0;

COMMENT ON COLUMN subject_elective_groups.max_subjects IS 'Maximum number of subjects allowed in this group';
COMMENT ON COLUMN subject_elective_groups.selectable_subjects IS 'Number of subjects a student must select from this group';
