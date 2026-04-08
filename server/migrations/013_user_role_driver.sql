-- Dedicated application role for school drivers (users.role_id → user_roles.id).
-- Also migrates existing staff-with-driver-designation users from administrative → driver.

INSERT INTO user_roles (role_name, description, is_active, created_at, modified_at)
SELECT
  'driver',
  'School transport driver — access limited to own vehicle, route, and assigned passengers',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE LOWER(TRIM(role_name)) = 'driver');

UPDATE users u
SET
  role_id = x.role_id,
  modified_at = NOW()
FROM (
  SELECT u2.id AS user_pk, ur.id AS role_id
  FROM users u2
  INNER JOIN staff s ON s.user_id = u2.id
  INNER JOIN designations d ON d.id = s.designation_id
  INNER JOIN user_roles ur ON LOWER(TRIM(ur.role_name)) = 'driver'
  WHERE LOWER(TRIM(d.designation_name)) IN ('driver', 'drivers')
) AS x
WHERE u.id = x.user_pk;
