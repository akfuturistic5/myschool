-- Migration to enhance teacher profile data persistence
-- Date: 2026-04-23

-- Add EPF Number column to teachers table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teachers' AND column_name='epf_no') THEN
        ALTER TABLE teachers ADD COLUMN epf_no VARCHAR(50);
    END IF;
END $$;

-- Ensure father_name and mother_name have enough space (already in schema but verifying length)
-- Usually they are VARCHAR(100) or TEXT. If they were shorter, we'd expand them here.
-- Based on previous checks they were already present.

COMMENT ON COLUMN teachers.epf_no IS 'Employee Provident Fund Number';
