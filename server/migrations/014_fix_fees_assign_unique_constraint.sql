-- =============================================================================
-- FIX FEES ASSIGN UNIQUE CONSTRAINT
-- =============================================================================

-- 1. Drop the old restrictive unique constraint
ALTER TABLE fees_assign DROP CONSTRAINT IF EXISTS fees_assign_student_id_academic_year_id_key;

-- 2. Add the correct unique constraint that includes fees_group_id
ALTER TABLE fees_assign ADD CONSTRAINT fees_assign_student_year_group_unique 
UNIQUE (student_id, academic_year_id, fees_group_id);
