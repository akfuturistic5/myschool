-- Add other_info column to teachers table
-- Date: 2026-04-24

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teachers' AND column_name='other_info') THEN
        ALTER TABLE teachers ADD COLUMN other_info TEXT;
    END IF;
END $$;

COMMENT ON COLUMN teachers.other_info IS 'Additional notes or information about the teacher';
