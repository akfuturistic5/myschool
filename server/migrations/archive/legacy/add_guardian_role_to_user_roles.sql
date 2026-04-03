-- =====================================================
-- Add Guardian Role (id=5) to user_roles table
-- =====================================================
-- Problem: users table has role_id 1-5 (admin, student, teacher, parent, guardian)
--          user_roles table has only 4 roles (missing guardian with id=5)
-- Solution: Insert guardian role so JOINs work correctly for users with role_id=5
-- =====================================================
-- RUN THIS QUERY MANUALLY IN YOUR DATABASE:
-- =====================================================

INSERT INTO user_roles (id, role_name, is_active, created_at)
SELECT 5, 'Guardian', true, NOW()
WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE id = 5);
