/*
=============================================================================
SUPER ADMIN SEEDER - PLATFORM LEVEL
=============================================================================
This script initializes the primary platform administrator.
=============================================================================
*/

-- 1. Default Super Admin User
-- Password placeholder: 'admin123' (hashed)
INSERT INTO public.super_admin_users (username, email, password_hash, role, is_active)
VALUES (
    'superadmin', 
    'admin@eschool.com', 
    '$2b$10$EpjXWzO2yzrvFsBRBySzW.03SleS1AL8p7SR0vY8S.C8u1m6p9S7q', -- admin123
    'super_admin', 
    true
)
ON CONFLICT (username) DO NOTHING;
