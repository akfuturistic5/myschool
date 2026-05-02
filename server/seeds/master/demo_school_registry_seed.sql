/*
=============================================================================
DEMO SCHOOL REGISTRY SEEDER - PLATFORM LEVEL
=============================================================================
This script registers a sample school in the central platform registry.
=============================================================================
*/

-- 1. Sample School Registration (Tenant)
INSERT INTO public.schools (school_name, institute_number, db_name, status, type)
VALUES (
    'St. Xavier''s International School', 
    'SXIS-2024-001', 
    'sxis_school_db', 
    'active', 
    'Secondary School'
)
ON CONFLICT (institute_number) DO NOTHING;
