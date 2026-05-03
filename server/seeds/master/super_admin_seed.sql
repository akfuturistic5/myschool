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
    '$2a$10$P8mgayf0xJP/tSa4mpl12elRzDbDTY1chWlsvU4xHGL1gdQZnFSy.', -- admin123
    'super_admin', 
    true
)
ON CONFLICT (username) DO NOTHING;
