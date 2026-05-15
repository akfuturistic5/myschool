
-- Add is_published column to exams table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'exams' AND column_name = 'is_published'
    ) THEN
        ALTER TABLE public.exams 
        ADD COLUMN is_published boolean DEFAULT false;
    END IF;
END $$;
