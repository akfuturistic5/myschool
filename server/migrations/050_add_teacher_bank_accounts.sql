-- Migration to add missing bank account columns to teachers table
-- Date: 2026-04-24

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teachers' AND column_name='account_name') THEN
        ALTER TABLE teachers ADD COLUMN account_name VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teachers' AND column_name='account_number') THEN
        ALTER TABLE teachers ADD COLUMN account_number VARCHAR(50);
    END IF;
END $$;

COMMENT ON COLUMN teachers.account_name IS 'Teacher bank account holder name';
COMMENT ON COLUMN teachers.account_number IS 'Teacher bank account number';
