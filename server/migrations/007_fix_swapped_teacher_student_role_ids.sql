-- Repair users.role_id after historical mismatch: app used STUDENT=2 / TEACHER=3 while
-- public.user_roles uses teacher=2, student=3. New inserts are fixed via server/src/config/roles.js.
-- Run once per tenant DB after deploying the code fix. Scoped by teachers / students only.

-- Teachers incorrectly stored as student role (3)
UPDATE users u
SET role_id = 2
FROM teachers t
INNER JOIN staff st ON t.staff_id = st.id
WHERE st.user_id = u.id
  AND u.role_id = 3;

-- Students incorrectly stored as teacher role (2); skip users who are also linked as teaching staff
UPDATE users u
SET role_id = 3
FROM students s
WHERE s.user_id = u.id
  AND u.role_id = 2
  AND NOT EXISTS (
    SELECT 1
    FROM teachers t
    INNER JOIN staff st ON t.staff_id = st.id
    WHERE st.user_id = u.id
  );
