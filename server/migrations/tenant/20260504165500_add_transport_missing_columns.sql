-- Add missing columns to transport_vehicles
ALTER TABLE public.transport_vehicles 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS made_of_year integer,
ADD COLUMN IF NOT EXISTS registration_number character varying(50),
ADD COLUMN IF NOT EXISTS chassis_number character varying(50),
ADD COLUMN IF NOT EXISTS gps_device_id character varying(100);

-- Add missing columns to routes
ALTER TABLE public.routes 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Add missing columns to pickup_points
ALTER TABLE public.pickup_points 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
