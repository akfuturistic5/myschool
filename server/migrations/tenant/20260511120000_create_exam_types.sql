-- 1. Create exam_types table
CREATE TABLE IF NOT EXISTS public.exam_types (
    id SERIAL PRIMARY KEY,
    type_name character varying(100) NOT NULL UNIQUE,
    description text,
    is_active boolean DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER,
    updated_by INTEGER
);

-- 2. Populate with existing types
INSERT INTO public.exam_types (type_name) 
VALUES 
    ('unit_test'), 
    ('monthly'), 
    ('quarterly'), 
    ('half_yearly'), 
    ('annual'), 
    ('preboard'), 
    ('internal'), 
    ('other')
ON CONFLICT (type_name) DO NOTHING;

-- 3. Remove the rigid CHECK constraint from exams table if it exists
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE table_name = 'exams' AND constraint_name = 'exams_exam_type_check') THEN
        ALTER TABLE public.exams DROP CONSTRAINT exams_exam_type_check;
    END IF;
END $$;
