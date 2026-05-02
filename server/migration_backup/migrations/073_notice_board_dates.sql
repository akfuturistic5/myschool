-- Notice Board scheduling columns (safe, idempotent)
-- Adds notice_date and publish_on without breaking existing rows.

BEGIN;

ALTER TABLE notice_board
  ADD COLUMN IF NOT EXISTS notice_date DATE,
  ADD COLUMN IF NOT EXISTS publish_on DATE;

-- Backfill publish_on for existing rows so historical notices remain visible immediately.
UPDATE notice_board
SET publish_on = COALESCE(publish_on, created_at::date)
WHERE publish_on IS NULL;

CREATE INDEX IF NOT EXISTS idx_notice_board_publish_on
  ON notice_board (publish_on);

CREATE INDEX IF NOT EXISTS idx_notice_board_notice_date
  ON notice_board (notice_date);

COMMIT;
