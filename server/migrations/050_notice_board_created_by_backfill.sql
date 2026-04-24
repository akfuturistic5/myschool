-- Backfill notice_board.created_by where NULL.
-- Keeps schema unchanged; only data correction.

BEGIN;

WITH candidate_user AS (
  SELECT id
  FROM users
  WHERE is_active = true
  ORDER BY
    CASE WHEN role_id IN (1, 6) THEN 0 ELSE 1 END,
    id ASC
  LIMIT 1
)
UPDATE notice_board nb
SET created_by = cu.id
FROM candidate_user cu
WHERE nb.created_by IS NULL;

COMMIT;
