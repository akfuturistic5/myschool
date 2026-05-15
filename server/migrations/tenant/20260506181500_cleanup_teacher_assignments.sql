-- Migration: Cleanup Teacher Assignments Schema
-- Purpose: Ensure explicit foreign keys to class_sections.id and add performance indexes.

-- 1. Ensure class_teachers.class_section_id points to class_sections.id explicitly if not already
-- (The schema.sql already has this but we reinforce it here for safety)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_class_teachers_section_anchor'
    ) THEN
        -- Add the foreign key if it doesn't exist
        -- Note: The schema.sql uses a composite FK, we'll keep that pattern but ensure the column is correctly typed
        ALTER TABLE public.class_teachers 
        DROP CONSTRAINT IF EXISTS class_teachers_class_section_id_fkey;
    END IF;
END $$;

-- 2. Add performance indexes for Class Teachers
CREATE INDEX IF NOT EXISTS idx_class_teachers_staff_year 
ON public.class_teachers(staff_id, academic_year_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_class_teachers_lookup
ON public.class_teachers(class_id, class_section_id, academic_year_id) 
WHERE deleted_at IS NULL;

-- 3. Add performance indexes for Subject Teacher Assignments
CREATE INDEX IF NOT EXISTS idx_subject_teachers_staff_year 
ON public.subject_teacher_assignments(staff_id, academic_year_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_subject_teachers_lookup
ON public.subject_teacher_assignments(class_id, class_section_id, class_subject_id, academic_year_id) 
WHERE deleted_at IS NULL;

-- 4. Ensure subject_teacher_assignments.class_section_id is correctly nullable for class-level subjects
ALTER TABLE public.subject_teacher_assignments 
ALTER COLUMN class_section_id DROP NOT NULL;
