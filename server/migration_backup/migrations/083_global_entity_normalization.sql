-- Migration: Global Entity Normalization
-- Objective: Ensure all master data entities are decoupled from academic years.

-- 1) Sections
ALTER TABLE public.sections DROP CONSTRAINT IF EXISTS sections_academic_year_id_fkey;
ALTER TABLE public.sections DROP COLUMN IF EXISTS academic_year_id;

-- 2) Transport Module
ALTER TABLE public.routes DROP CONSTRAINT IF EXISTS routes_academic_year_id_fkey;
ALTER TABLE public.routes DROP COLUMN IF EXISTS academic_year_id;

ALTER TABLE public.pickup_points DROP CONSTRAINT IF EXISTS pickup_points_academic_year_id_fkey;
ALTER TABLE public.pickup_points DROP COLUMN IF EXISTS academic_year_id;

ALTER TABLE public.drivers DROP CONSTRAINT IF EXISTS drivers_academic_year_id_fkey;
ALTER TABLE public.drivers DROP COLUMN IF EXISTS academic_year_id;

ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_academic_year_id_fkey;
ALTER TABLE public.vehicles DROP COLUMN IF EXISTS academic_year_id;

ALTER TABLE public.transport_assignments DROP CONSTRAINT IF EXISTS transport_assignments_academic_year_id_fkey;
ALTER TABLE public.transport_assignments DROP COLUMN IF EXISTS academic_year_id;

-- 3) Hostel Module
ALTER TABLE public.hostels DROP CONSTRAINT IF EXISTS hostels_academic_year_id_fkey;
ALTER TABLE public.hostels DROP COLUMN IF EXISTS academic_year_id;

ALTER TABLE public.hostel_rooms DROP CONSTRAINT IF EXISTS hostel_rooms_academic_year_id_fkey;
ALTER TABLE public.hostel_rooms DROP COLUMN IF EXISTS academic_year_id;

ALTER TABLE public.room_types DROP CONSTRAINT IF EXISTS room_types_academic_year_id_fkey;
ALTER TABLE public.room_types DROP COLUMN IF EXISTS academic_year_id;
