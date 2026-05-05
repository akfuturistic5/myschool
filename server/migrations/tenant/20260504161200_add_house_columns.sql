-- Add house_color and house_captain columns to houses table
ALTER TABLE public.houses 
ADD COLUMN IF NOT EXISTS house_color VARCHAR(50),
ADD COLUMN IF NOT EXISTS house_captain VARCHAR(100);
