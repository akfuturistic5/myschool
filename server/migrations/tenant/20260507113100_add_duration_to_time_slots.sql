-- Add duration column to timetable_time_slots if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'timetable_time_slots' AND column_name = 'duration') THEN
        ALTER TABLE public.timetable_time_slots ADD COLUMN duration INTEGER;
    END IF;
END $$;

-- Populate duration for existing records
UPDATE public.timetable_time_slots 
SET duration = EXTRACT(EPOCH FROM (end_time - start_time)) / 60 
WHERE duration IS NULL;
