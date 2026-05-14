
-- Add classroom tracking to exam schedules
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'exam_schedules' AND column_name = 'class_room_id'
    ) THEN
        ALTER TABLE public.exam_schedules 
        ADD COLUMN class_room_id integer REFERENCES public.class_rooms(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_exam_schedules_room ON public.exam_schedules(class_room_id);
