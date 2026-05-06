-- Migration to link class_sections to class_rooms master table
-- 1. Add class_room_id column to class_sections
-- 2. Add foreign key constraint

DO $$ 
BEGIN
    -- [1] Add class_room_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'class_sections' AND column_name = 'class_room_id') THEN
        ALTER TABLE public.class_sections ADD COLUMN class_room_id integer REFERENCES public.class_rooms(id) ON DELETE SET NULL;
    END IF;

    -- [2] Optional: Try to migrate existing room_number strings to class_room_id if they match
    -- This is a best-effort migration
    UPDATE public.class_sections cs
    SET class_room_id = cr.id
    FROM public.class_rooms cr
    WHERE cs.room_number = cr.room_number
    AND cs.class_room_id IS NULL;

END $$;
