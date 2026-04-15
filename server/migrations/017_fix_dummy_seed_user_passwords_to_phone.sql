-- =============================================================================
-- Migration: 017_fix_dummy_seed_user_passwords_to_phone.sql
-- Purpose:
--   Fix already-seeded dummy accounts so each user's password becomes their own
--   phone number (hashed with bcrypt via pgcrypto crypt/gen_salt).
--
-- Scope:
--   ONLY touches seeded dummy accounts created by migrations 005/006.
--   Real/production users are not updated.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

WITH seeded_users AS (
  SELECT
    u.id,
    regexp_replace(COALESCE(u.phone, ''), '\D', '', 'g') AS phone_digits
  FROM users u
  WHERE (
      u.username LIKE 'stu_ay%'
      OR u.username LIKE 'father_adm_ay%'
      OR u.username LIKE 'mother_adm_ay%'
      OR u.username LIKE 'guardian_adm_ay%'
    )
    AND u.is_active = true
)
UPDATE users u
SET
  password_hash = crypt(su.phone_digits, gen_salt('bf', 10)),
  modified_at = NOW()
FROM seeded_users su
WHERE u.id = su.id
  AND su.phone_digits <> '';

COMMIT;
