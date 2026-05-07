-- Migration to relax class_room_id constraint in class_schedules
-- This allows creating schedules for sections that haven't been assigned a specific room yet.

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'class_schedules' AND column_name = 'class_room_id') THEN
        ALTER TABLE public.class_schedules ALTER COLUMN class_room_id DROP NOT NULL;
    END IF;
END $$;
