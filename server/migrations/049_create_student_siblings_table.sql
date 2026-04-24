-- Create student_siblings table and migrate legacy columns if they exist
-- Date: 2026-04-24

CREATE TABLE IF NOT EXISTS student_siblings (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    is_in_same_school BOOLEAN DEFAULT false,
    name TEXT,
    class_name TEXT,
    section_name TEXT,
    roll_number TEXT,
    admission_number TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    modified_at TIMESTAMP DEFAULT NOW()
);

-- Backfill from legacy columns if they still exist (for existing databases)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='sibiling_1') THEN
        INSERT INTO student_siblings (student_id, name, class_name)
        SELECT id, sibiling_1, sibiling_1_class 
        FROM students 
        WHERE sibiling_1 IS NOT NULL AND TRIM(sibiling_1) <> '';
        
        ALTER TABLE students DROP COLUMN sibiling_1;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='sibiling_2') THEN
        INSERT INTO student_siblings (student_id, name, class_name)
        SELECT id, sibiling_2, sibiling_2_class 
        FROM students 
        WHERE sibiling_2 IS NOT NULL AND TRIM(sibiling_2) <> '';
        
        ALTER TABLE students DROP COLUMN sibiling_2;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='sibiling_1_class') THEN
        ALTER TABLE students DROP COLUMN sibiling_1_class;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='sibiling_2_class') THEN
        ALTER TABLE students DROP COLUMN sibiling_2_class;
    END IF;
END $$;
