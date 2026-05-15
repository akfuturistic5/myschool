-- Make pen_number and aadhar_no nullable in students table
ALTER TABLE public.students ALTER COLUMN pen_number DROP NOT NULL;
ALTER TABLE public.students ALTER COLUMN aadhar_no DROP NOT NULL;
